// supabase/functions/get-available-slots/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

import dayjs from "https://esm.sh/dayjs@1.11.7";
import utc from "https://esm.sh/dayjs@1.11.7/plugin/utc.js";
import timezone from "https://esm.sh/dayjs@1.11.7/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const AUS_TZ = "Australia/Sydney";

console.log("Hello from get-available-slots Edge Function!");

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: {
        persistSession: false,
      },
    }
  );

  try {
    const { shop_id, services_ids, date_string, barber_id } = await req.json();

    if (
      !shop_id ||
      !date_string ||
      !Array.isArray(services_ids) ||
      services_ids.length === 0
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: shop_id, services_ids, date_string",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse target date in AUS timezone
    const targetDate = dayjs.tz(date_string, AUS_TZ);
    const startOfTargetDay = targetDate.startOf("day");
    const endOfTargetDay = targetDate.endOf("day");

    // 1. Fetch Shop Operating Hours
    const { data: shopData, error: shopError } = await supabaseClient
      .from("shops")
      .select("opening_time, closing_time")
      .eq("id", shop_id)
      .single();

    if (shopError || !shopData) {
      console.error("Shop fetch error:", shopError);
      return new Response(
        JSON.stringify({ error: "Shop not found or couldn't fetch hours" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse shop opening/closing times on the target date with timezone
    const [openHour, openMinute] = shopData.opening_time.split(":").map(Number);
    const [closeHour, closeMinute] = shopData.closing_time.split(":").map(Number);

    let dayOpen = targetDate.hour(openHour).minute(openMinute).second(0).millisecond(0);
    let dayClose = targetDate.hour(closeHour).minute(closeMinute).second(0).millisecond(0);

    // Handle closing time past midnight (e.g., 23:00 to 02:00)
    if (dayClose.isBefore(dayOpen) || dayClose.isSame(dayOpen)) {
      dayClose = dayClose.add(1, "day");
    }

    // 2. Fetch Barbers working today (filter optional barber_id)
    let barbersQuery = supabaseClient
      .from("barbers")
      .select("id, name, is_working_today, is_on_break, break_end_time")
      .eq("shop_id", shop_id)
      .eq("is_working_today", true);

    if (barber_id) {
      barbersQuery = barbersQuery.eq("id", barber_id);
    }

    const { data: barbersData, error: barbersError } = await barbersQuery;

    if (barbersError || !barbersData) {
      console.error("Barbers fetch error:", barbersError);
      return new Response(
        JSON.stringify({ error: "Couldn't fetch barbers" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const workingBarbers = barbersData.filter((b) => b.is_working_today);
    if (workingBarbers.length === 0) {
      return new Response(
        JSON.stringify({ available_slots: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Calculate total required service duration
    const { data: servicesData, error: servicesError } = await supabaseClient
      .from("services")
      .select("duration_minutes")
      .in("id", services_ids);

    if (
      servicesError ||
      !servicesData ||
      servicesData.length !== services_ids.length
    ) {
      console.error("Services fetch error:", servicesError);
      return new Response(
        JSON.stringify({ error: "Couldn't fetch service durations" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const totalServiceDuration = servicesData.reduce(
      (sum, s) => sum + s.duration_minutes,
      0
    );
    const bufferMinutes = 10; // Buffer between appointments
    const slotInterval = 30; // Slot step in minutes
    const totalSlotDuration = totalServiceDuration + bufferMinutes;

    // 4. Fetch existing appointments and queue entries for the target day
    const { data: existingAppointments, error: apptError } =
      await supabaseClient
        .from("appointments")
        .select("barber_id, start_time, end_time")
        .eq("shop_id", shop_id)
        .in("status", ["booked", "checked_in", "in_progress"])
        .gte("start_time", startOfTargetDay.toISOString())
        .lt("start_time", endOfTargetDay.toISOString());

    if (apptError) {
      console.error("Appointments fetch error:", apptError);
      return new Response(
        JSON.stringify({ error: "Couldn't fetch existing appointments" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: currentQueue, error: queueError } = await supabaseClient
      .from("queue_entries")
      .select("barber_id, created_at, queue_entry_services(services(duration_minutes))")
      .eq("shop_id", shop_id)
      .in("status", ["waiting", "in_progress"])
      .gte("created_at", startOfTargetDay.toISOString())
      .lt("created_at", endOfTargetDay.toISOString());

    if (queueError) {
      console.error("Queue fetch error:", queueError);
      return new Response(
        JSON.stringify({ error: "Couldn't fetch current queue" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const availableSlots: {
      barber_id: string;
      barber_name: string;
      time: string;
    }[] = [];

    // Get 'now' in AUS timezone
    const now = dayjs().tz(AUS_TZ);

    for (const barber of workingBarbers) {
      // Earliest time barber can start new service on target day
      let minimumStartTimeForBarber = dayOpen;

      // 1. If target day is today, earliest is now
      if (targetDate.isSame(now, "day")) {
        if (minimumStartTimeForBarber.isBefore(now)) {
          minimumStartTimeForBarber = now;
        }
      }

      // 2. Adjust for barber's break time
      if (barber.is_on_break && barber.break_end_time) {
        const breakEnd = dayjs.tz(barber.break_end_time, AUS_TZ);
        if (breakEnd.isAfter(minimumStartTimeForBarber)) {
          minimumStartTimeForBarber = breakEnd;
        }
      }

      // 3. Adjust for current queue load
      let estimatedQueueDuration = 0;
      const currentBarberQueue = currentQueue.filter(
        (entry) => entry.barber_id === barber.id
      );
      if (currentBarberQueue.length > 0) {
        estimatedQueueDuration = currentBarberQueue.reduce((sum, entry) => {
          const serviceDuration = entry.queue_entry_services
            ? entry.queue_entry_services.reduce(
                (total: number, qes: any) =>
                  total + (qes.services?.duration_minutes || 0),
                0
              )
            : 0;
          return sum + serviceDuration;
        }, 0);
        estimatedQueueDuration += currentBarberQueue.length * 5; // small buffer per client
      }

      let estimatedQueueFinishTime = now.add(estimatedQueueDuration, "minute");

      if (
        targetDate.isSame(now, "day") &&
        estimatedQueueFinishTime.isAfter(minimumStartTimeForBarber)
      ) {
        minimumStartTimeForBarber = estimatedQueueFinishTime;
      }

      // 4. Round up to nearest slotInterval
      const minute = minimumStartTimeForBarber.minute();
      const remainder = minute % slotInterval;
      if (remainder > 0) {
        minimumStartTimeForBarber = minimumStartTimeForBarber.add(
          slotInterval - remainder,
          "minute"
        );
      }
      minimumStartTimeForBarber = minimumStartTimeForBarber
        .second(0)
        .millisecond(0);

      // Filter appointments for barber & sort by start time
      const barberAppointments = existingAppointments
        .filter((appt) => appt.barber_id === barber.id)
        .map((appt) => ({
          start: dayjs(appt.start_time).tz(AUS_TZ),
          end: dayjs(appt.end_time).tz(AUS_TZ),
        }))
        .sort((a, b) => a.start.valueOf() - b.start.valueOf());

      let currentTime = minimumStartTimeForBarber;

      while (
        currentTime.add(totalSlotDuration, "minute").isBefore(dayClose) ||
        currentTime
          .add(totalSlotDuration, "minute")
          .isSame(dayClose, "minute")
      ) {
        let isSlotAvailable = true;
        const slotEnd = currentTime.add(totalSlotDuration, "minute");

        for (const appt of barberAppointments) {
          // Overlap check: (startA < endB) && (endA > startB)
          if (
            currentTime.isBefore(appt.end) &&
            slotEnd.isAfter(appt.start)
          ) {
            isSlotAvailable = false;

            // Move currentTime past conflicting appointment + buffer
            let nextPossibleTimeAfterConflict = appt.end.add(bufferMinutes, "minute");

            // Round up to next slot interval
            const nextConflictMinute = nextPossibleTimeAfterConflict.minute();
            const nextConflictRemainder = nextConflictMinute % slotInterval;
            if (nextConflictRemainder > 0) {
              nextPossibleTimeAfterConflict = nextPossibleTimeAfterConflict.add(
                slotInterval - nextConflictRemainder,
                "minute"
              );
            }
            nextPossibleTimeAfterConflict = nextPossibleTimeAfterConflict
              .second(0)
              .millisecond(0);

            currentTime =
              nextPossibleTimeAfterConflict.isAfter(currentTime)
                ? nextPossibleTimeAfterConflict
                : currentTime.add(slotInterval, "minute");

            break; // break appointments loop, re-check from new currentTime
          }
        }

        if (isSlotAvailable) {
          availableSlots.push({
            barber_id: barber.id,
            barber_name: barber.name,
            time: currentTime.format("HH:mm"),
          });

          // Move to next slot
          currentTime = currentTime.add(slotInterval, "minute");
        }
      }
    }

    // Sort by time, then barber name
    availableSlots.sort((a, b) => {
      if (a.time < b.time) return -1;
      if (a.time > b.time) return 1;
      return a.barber_name.localeCompare(b.barber_name);
    });

    return new Response(
      JSON.stringify({ available_slots: availableSlots }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
