"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { createClient } from "../../../lib/supabase/client";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../../components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "../../../components/ui/dialog";
import {
  Shuffle,
  MapPin,
  Clock,
  Timer,
  ChevronDown,
  CalendarDays,
  Loader2,
  CheckCircle2, // Added for success messages
  ListChecks, // Icon for services
  User, // Icon for staff/barber
  Phone, // Icon for phone number
} from "lucide-react";
import { toast } from "sonner";
import { motion, easeInOut } from "framer-motion";
import { Calendar } from "../../../components/ui/calendar";
import { format, addDays, isBefore, isAfter, addMinutes } from "date-fns";

// Animation Variants
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeInOut } },
};

const fadeInUp = {
  initial: { opacity: 0, y: 50 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeInOut } },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Type definitions (ensure these match your Supabase schema precisely)
type Shop = {
  id: string;
  name: string;
  logo_url: string | null;
  address: string;
  opening_time: string | null;
  closing_time: string | null;
};
type ServiceDuration = {
  duration_minutes: number | null;
};
type QueueEntryService = {
  services: ServiceDuration | null;
};
type FetchedQueueEntry = {
  barber_id: string;
  queue_entry_services: QueueEntryService[];
};
type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  category: string | null;
  description: string | null;
};
type Barber = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_on_break: boolean;
  break_end_time: string | null;
};
type QueueEntryWithBarber = {
  id: string;
  status: "waiting" | "in_progress" | "booked";
  client_name: string;
  client_phone: string;
  barbers: {
    name: string;
    id: string;
  } | null;
  appointment_id: string | null;
  start_time?: string;
};
type NewQueueEntryData = {
  id: string;
  queue_position: number;
  client_name: string;
};

// Props interface for BookingClient
interface BookingClientProps {
  shop: Shop;
  items: Service[]; // Services offered by the shop
  staffMembers: Barber[]; // Staff members working at the shop
}

export default function BookingClient({
  shop,
  items,
  staffMembers,
}: BookingClientProps) {
  const supabase = createClient();

  // --- MODE SELECTION STATES ---
  const [mode, setMode] = useState<"queue" | "appointment" | null>(null); // Controls current form mode
  const [currentStep, setCurrentStep] = useState(0); // 0: mode, 1: services, 2: barber, 3: date/time (appointment) / details (queue), 4: details (appointment), 5: submit

  // --- GENERAL FORM STATES ---
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [loading, setLoading] = useState(false); // General loading for form submission
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevents multiple submissions

  // --- QUEUE SPECIFIC STATES ---
  // Reusing selectedBarber for both modes; context will be determined by 'mode'
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [queueInfo, setQueueInfo] = useState<{
    position: number;
    name: string;
  } | null>(null); // Info after joining walk-in queue
  const [waitingCounts, setWaitingCounts] = useState<Record<string, number>>(
    {},
  ); // Number of clients waiting per barber
  const [waitTimes, setWaitTimes] = useState<Record<string, number>>({}); // Estimated wait time per barber

  // --- APPOINTMENT SPECIFIC STATES ---
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<
    { barber_id: string; barber_name: string; time: string }[]
  >([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    barber_id: string;
    barber_name: string;
    time: string;
  } | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<{
    appointmentId: string;
    clientName: string;
    dateTime: string;
    barberName: string;
  } | null>(null);

  // --- CHECK STATUS DIALOG STATES ---
  const [checkName, setCheckName] = useState("");
  const [checkPhone, setCheckPhone] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkedPositionInfo, setCheckedPositionInfo] = useState<string | null>(
    null,
  );
  const [isCheckStatusDialogOpen, setIsCheckStatusDialogOpen] = useState(false);

  // --- Refs for scrolling ---
  const servicesRef = useRef<HTMLDivElement>(null);
  const barberRef = useRef<HTMLDivElement>(null);
  const dateTimeRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // Determine if the shop is currently open based on operating hours
  const isShopOpen = useMemo(() => {
    if (!shop.opening_time || !shop.closing_time) {
      return true; // Assume open if times are not defined
    }
    const now = new Date();
    const [openingHours, openingMinutes] = shop.opening_time
      .split(":")
      .map(Number);
    const [closingHours, closingMinutes] = shop.closing_time
      .split(":")
      .map(Number);
    const openingDate = new Date();
    openingDate.setHours(openingHours, openingMinutes, 0);
    const closingDate = new Date();
    closingDate.setHours(closingHours, closingMinutes, 0);
    return now >= openingDate && now <= closingDate;
  }, [shop.opening_time, shop.closing_time]);

  // Format time strings for display (e.g., 9:00 AM)
  const formatTime = (timeString: string | null) => {
    if (!timeString) return "N/A";
    try {
      const [hours, minutes] = timeString.split(":").map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch (e) {
      console.error("Error formatting time:", timeString, e);
      return timeString;
    }
  };

  // Group services by category for collapsible display
  const categorizedServices = useMemo(() => {
    return items.reduce((acc, service) => {
      const category = service.category || "Uncategorized";
      if (!acc[category]) acc[category] = [];
      acc[category].push(service);
      return acc;
    }, {} as Record<string, Service[]>);
  }, [items]);

  // Validate Australian phone numbers
  const isValidAustralianPhone = useCallback(
    (phone: string) => /^(04|02|03|07|08)\d{8}$/.test(phone.replace(/\s/g, "")),
    [],
  );

  // Calculate total price of selected services
  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, service) => sum + service.price, 0),
    [selectedServices],
  );

  // Handle selection/deselection of services
  const handleServiceSelect = useCallback((service: Service) => {
    setSelectedServices((prev) => {
      const isSelected = prev.some((s) => s.id === service.id);
      let newSelection: Service[];

      if (isSelected) {
        newSelection = prev.filter((s) => s.id !== service.id);
      } else {
        newSelection = [...prev, service];
      }

      // Reset subsequent selections if services change
      setSelectedBarber(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
      setAvailableSlots([]);

      return newSelection;
    });
  }, []);

  // Fetch and update real-time queue details (waiting counts and wait times)
  const fetchQueueDetails = useCallback(async () => {
  if (!Array.isArray(staffMembers) || staffMembers.length === 0) {
    return;
  }

  const { data, error } = await supabase
    .from("queue_entries")
    .select(`barber_id, queue_entry_services (services (duration_minutes))`)
    .eq("shop_id", shop.id)
    .eq("status", "waiting");

  if (error) {
    console.error("Error fetching queue details:", error);
    return;
  }

  const newWaitTimes: Record<string, number> = {};
  const now = new Date();

  // Initialize newWaitTimes with break times for each barber
  staffMembers.forEach((barber) => {
    if (barber.is_on_break && barber.break_end_time) {
      const breakEndTime = new Date(barber.break_end_time);
      if (isAfter(breakEndTime, now)) {
        const remainingBreakMs = breakEndTime.getTime() - now.getTime();
        newWaitTimes[barber.id] = Math.ceil(remainingBreakMs / 60000);
      }
    } else {
      // Ensure all barbers are initialized, even if not on break, to 0 if no break applies
      newWaitTimes[barber.id] = 0;
    }
  });

  const newCounts: Record<string, number> = {};
  for (const entry of data as unknown as FetchedQueueEntry[]) {
    if (entry.barber_id) {
      newCounts[entry.barber_id] = (newCounts[entry.barber_id] || 0) + 1;
      if (Array.isArray(entry.queue_entry_services)) {
        const entryDuration = entry.queue_entry_services.reduce(
          (total, qes) => total + (qes.services?.duration_minutes || 0),
          0,
        );
        // CORRECTED LINE: Use entry.barber_id instead of barber.id
        newWaitTimes[entry.barber_id] =
          (newWaitTimes[entry.barber_id] || 0) + entryDuration;
      }
    }
  }
  setWaitingCounts(newCounts);
  setWaitTimes(newWaitTimes);
}, [supabase, shop.id, staffMembers]);

  // Set up real-time subscriptions for queue updates
  useEffect(() => {
    if (staffMembers.length > 0) {
      fetchQueueDetails();
    }

    const channel = supabase
      .channel(`booking_queue_realtime_for_${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => {
          fetchQueueDetails();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, shop.id, fetchQueueDetails, staffMembers]);

  // Logic for fetching available slots for appointments
  useEffect(() => {
    async function fetchSlots() {
      // Only fetch if a barber is selected for appointment mode
      if (!selectedDate || selectedServices.length === 0 || !selectedBarber) {
        setAvailableSlots([]);
        return;
      }
      setLoadingSlots(true);
      setSelectedSlot(null); // Clear selected slot if date, services, or barber change

      const serviceIds = selectedServices.map((s) => s.id);
      const dateString = format(selectedDate, "yyyy-MM-dd");

      try {
        const response = await fetch("/api/supabase-edge-function", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            functionName: "get-available-slots",
            payload: {
              shop_id: shop.id,
              services_ids: serviceIds,
              date_string: dateString,
              barber_id: selectedBarber.id, // Pass the selected barber's ID
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to fetch available slots.",
          );
        }

        const { available_slots } = await response.json();
        setAvailableSlots(available_slots);
      } catch (error) {
        console.error("Error fetching slots:", error);
        toast.error(
          `Failed to load slots: ${error instanceof Error ? error.message : "An unknown error occurred."}`,
        );
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    if (mode === "appointment" && currentStep >= 3) { // Only fetch slots when on the date/time step
      fetchSlots();
    }
  }, [selectedDate, selectedServices, selectedBarber, shop.id, mode, currentStep]);

  // Handle client joining the walk-in queue
  const handleJoinQueue = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (
        isSubmitting ||
        !selectedBarber || // For Queue, staff must be selected
        selectedServices.length === 0 ||
        !clientName ||
        !clientPhone
      ) {
        toast.error("Please complete all steps before joining.");
        return;
      }
      if (!isValidAustralianPhone(clientPhone)) {
        toast.error("Please enter a valid 10-digit Australian phone number.");
        return;
      }
      setLoading(true);
      setIsSubmitting(true);
      try {
        let clientId = null;
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("phone", clientPhone)
          .eq("shop_id", shop.id)
          .single();

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const { data: newClient, error: newClientError } = await supabase
            .from("clients")
            .insert({ name: clientName, phone: clientPhone, shop_id: shop.id })
            .select("id")
            .single();
          if (newClientError) throw newClientError;
          clientId = newClient.id;
        }

        const { data: queueData, error: rpcError } = await supabase.rpc(
          "create_queue_entry_with_services",
          {
            p_shop_id: shop.id,
            p_barber_id: selectedBarber.id,
            p_client_id: clientId,
            p_client_name: clientName,
            p_client_phone: clientPhone,
            p_service_ids: selectedServices.map((s) => s.id),
            p_appointment_id: null,
          },
        );

        if (rpcError) throw rpcError;

        const newEntry = queueData as NewQueueEntryData;
        if (newEntry) {
          const { data: waitingQueue } = await supabase
            .from("queue_entries")
            .select("id, queue_position")
            .eq("barber_id", selectedBarber.id)
            .eq("status", "waiting")
            .order("queue_position", { ascending: true });
          const position = waitingQueue
            ? waitingQueue.findIndex((entry) => entry.id === newEntry.id) + 1
            : 0;
          setQueueInfo({
            position: position > 0 ? position : waitingQueue?.length ?? 1,
            name: newEntry.client_name,
          });
          setSelectedServices([]);
          setSelectedBarber(null);
          setClientName("");
          setClientPhone("");
          setCurrentStep(0); // Reset for new booking
        }
      } catch (error) {
        toast.error(
          `Error joining queue: ${error instanceof Error ? error.message : "An unknown error occurred."}`,
        );
      } finally {
        setLoading(false);
        setTimeout(() => setIsSubmitting(false), 3000);
      }
    },
    [isSubmitting, selectedBarber, selectedServices, clientName, clientPhone, isValidAustralianPhone, supabase, shop.id],
  );

  // Handle Appointment Booking
  const handleBookAppointment = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (
        isSubmitting ||
        !selectedSlot ||
        !selectedBarber || // Also require selectedBarber for booking
        selectedServices.length === 0 ||
        !clientName ||
        !clientPhone
      ) {
        toast.error("Please complete all booking details.");
        return;
      }
      if (!isValidAustralianPhone(clientPhone)) {
        toast.error("Please enter a valid 10-digit Australian phone number.");
        return;
      }

      setLoading(true);
      setIsSubmitting(true);

      try {
        let clientId = null;
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("phone", clientPhone)
          .eq("shop_id", shop.id)
          .single();

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const { data: newClient, error: newClientError } = await supabase
            .from("clients")
            .insert({ name: clientName, phone: clientPhone, shop_id: shop.id })
            .select("id")
            .single();
          if (newClientError) throw newClientError;
          clientId = newClient.id;
        }

        const totalDuration = selectedServices.reduce(
          (sum, s) => sum + s.duration_minutes,
          0,
        );
        const [slotHour, slotMinute] = selectedSlot.time.split(":").map(Number);
        const appointmentStart = new Date(selectedDate!);
        appointmentStart.setHours(slotHour, slotMinute, 0, 0);
        const appointmentEnd = addMinutes(appointmentStart, totalDuration);

        const { data: newAppointment, error: apptError } = await supabase
          .from("appointments")
          .insert({
            shop_id: shop.id,
            barber_id: selectedBarber.id, // Use selectedBarber here
            client_id: clientId,
            client_name: clientName,
            client_phone: clientPhone,
            start_time: appointmentStart.toISOString(),
            end_time: appointmentEnd.toISOString(),
            total_price: totalPrice,
            status: "booked",
            service_ids: selectedServices.map((s) => s.id),
          })
          .select("id, start_time")
          .single();

        if (apptError) throw apptError;

        setBookingConfirmation({
          appointmentId: newAppointment.id,
          clientName: clientName,
          dateTime: format(newAppointment.start_time, "EEE, MMM dd, h:mm a"),
          barberName: selectedSlot.barber_name,
        });

        setSelectedServices([]);
        setSelectedBarber(null); // Clear selected barber for next booking
        setSelectedDate(undefined);
        setSelectedSlot(null);
        setAvailableSlots([]);
        setClientName("");
        setClientPhone("");
        setCurrentStep(0); // Reset for new booking
      } catch (error) {
        toast.error(
          `Error booking appointment: ${error instanceof Error ? error.message : "An unknown error occurred."}`,
        );
      } finally {
        setLoading(false);
        setTimeout(() => setIsSubmitting(false), 3000);
      }
    },
    [isSubmitting, selectedSlot, selectedBarber, selectedServices, clientName, clientPhone, isValidAustralianPhone, supabase, shop.id, selectedDate, totalPrice],
  );

  // Handle client checking their position or appointment status
  const handleCheckPosition = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!checkName || !checkPhone) {
        setCheckedPositionInfo("Please enter both name and phone.");
        return;
      }
      if (!isValidAustralianPhone(checkPhone)) {
        setCheckedPositionInfo("Please enter a valid Australian phone number.");
        return;
      }
      setIsChecking(true);
      setCheckedPositionInfo(null);

      const { data: queueEntry, error: queueError } = await supabase
        .from("queue_entries")
        .select(`id, status, client_name, client_phone, barbers ( id, name ), appointment_id`)
        .ilike("client_name", checkName)
        .eq("client_phone", checkPhone.replace(/\s/g, ""))
        .in("status", ["waiting", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single<QueueEntryWithBarber>();

      if (queueError && queueError.code !== 'PGRST116') {
        console.error("Error fetching queue entry:", queueError);
      }

      const { data: appointmentEntry, error: apptError } = await supabase
        .from("appointments")
        .select(`id, status, client_name, client_phone, barbers ( id, name ), start_time`)
        .ilike("client_name", checkName)
        .eq("client_phone", checkPhone.replace(/\s/g, ""))
        .in("status", ["booked"])
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(1)
        .single<QueueEntryWithBarber>();

      if (apptError && apptError.code !== 'PGRST116') {
        console.error("Error fetching appointment entry:", apptError);
      }

      if (queueEntry) {
        if (queueEntry.status === "in_progress") {
          setCheckedPositionInfo(
            `You are currently being served by ${queueEntry.barbers?.name || "a staff member"}!`,
          );
        } else {
          const { data: waitingQueue } = await supabase
            .from("queue_entries")
            .select("id")
            .eq("barber_id", queueEntry.barbers!.id)
            .eq("status", "waiting")
            .order("queue_position", { ascending: true });

          const position = waitingQueue
            ? waitingQueue.findIndex((entry) => entry.id === queueEntry.id) + 1
            : 0;

          setCheckedPositionInfo(
            `You are number ${position} in the walk-in queue for ${queueEntry.barbers?.name}.`,
          );
        }
      } else if (appointmentEntry) {
        setCheckedPositionInfo(
          `You have an appointment on ${format(appointmentEntry.start_time!, 'EEE, MMM dd, h:mm a')} with ${appointmentEntry.barbers?.name}. Please arrive a few minutes early!`,
        );
      } else {
        setCheckedPositionInfo("We couldn't find you in the active queue or with a future appointment. Please ensure your name and phone number match what you provided.");
      }

      setIsChecking(false);
    },
    [checkName, checkPhone, isValidAustralianPhone, supabase],
  );

  const resetForm = () => {
    setSelectedServices([]);
    setSelectedBarber(null);
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setAvailableSlots([]);
    setClientName("");
    setClientPhone("");
    setQueueInfo(null);
    setBookingConfirmation(null);
    setCurrentStep(0);
    setMode(null);
  };

  const scrollToNextStep = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      window.scrollTo({
        top: ref.current.offsetTop - 20, // Adjust offset as needed
        behavior: "smooth",
      });
    }
  };

  const handleNextStepClick = (nextStepIndex: number, ref: React.RefObject<HTMLDivElement | null>) => {
    setCurrentStep(nextStepIndex);
    // Use a small timeout to ensure the new content is rendered before scrolling
    // This is important for React's rendering cycle
    setTimeout(() => scrollToNextStep(ref), 100);
  };


  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      {/* Shop Header: Logo/Name, Address */}
      <motion.header
        variants={fadeIn}
        initial="initial"
        animate="animate"
        // Adjust vertical padding (py) for a more compact header
        className="mb-4 flex items-center justify-between py-1" // Changed from no explicit padding
      >
        {/* Left Section: Shop Logo/Name */}
        <div className="flex items-center">
          {shop.logo_url ? (
            <div className="mr-3"> {/* Slightly reduced margin-right */}
              <Image
                src={shop.logo_url}
                alt={`${shop.name} Logo`}
                width={140} // Slightly reduced width for logo
                height={35} // Slightly reduced height for logo
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-primary"> {/* Reduced font size */}
              {shop.name}
            </h1>
          )}
        </div>

        {/* Right Section: Icons */}
        <div className="flex items-center gap-3"> {/* Slightly reduced gap between icons */}
          {/* Location Icon */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <MapPin className="h-5 w-5 md:h-6 md:w-6" /> {/* Optionally reduce icon size */}
              </Button>
            </DialogTrigger>
            <DialogContent className="text-center">
              <DialogHeader>
                <DialogTitle>Shop Location</DialogTitle>
                <DialogDescription>
                  <p className="text-xlg font-semibold text-primary">{shop.name}</p>
                  <p className="text-muted-foreground">{shop.address}</p>
                </DialogDescription>
              </DialogHeader>
              
            </DialogContent>
          </Dialog>

          {/* Clock Icon */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <Clock className="h-5 w-5 md:h-6 md:w-6" /> {/* Optionally reduce icon size */}
              </Button>
            </DialogTrigger>
            <DialogContent className="text-center">
              <DialogHeader>
                <DialogTitle>Operating Hours</DialogTitle>
                <DialogDescription>
                  <p className="text-xlg text-muted-foreground">
                    Open from{" "}
                    <span className="font-semibold text-primary/80">
                      {formatTime(shop.opening_time)}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-primary/80">
                      {formatTime(shop.closing_time)}
                    </span>
                  </p>
                </DialogDescription>
              </DialogHeader>
              
            </DialogContent>
          </Dialog>
        </div>
      </motion.header>

      <Separator className="bg-border/50 mb-8" />

      {/* Conditional Rendering based on success messages or shop open/closed */}
      {!isShopOpen ? (
        // Shop Closed Message
        <motion.div variants={fadeIn} initial="initial" animate="animate">
          <Card className="mt-8 text-center p-8 bg-card border-border shadow-lg">
            <CardHeader>
              <Clock className="mx-auto h-16 w-16 text-muted-foreground animate-pulse" />
              <CardTitle className="mt-4 text-3xl font-bold">
                Sorry, We&apos;re Currently Closed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-lg">
                Our operating hours are from{" "}
                <span className="font-semibold text-primary">
                  {formatTime(shop.opening_time)}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-primary">
                  {formatTime(shop.closing_time)}
                </span>
                . Please check back later!
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : queueInfo ? (
        // Walk-in Queue Success Message
        <motion.div
  variants={fadeIn}
  initial="initial"
  animate="animate"
  className="mt-8"
>
  <Alert className="mt-6 bg-green-100 border-green-300 text-center p-6 shadow-lg rounded-xl animate-fade-in animate-once">
  <AlertTitle className="text-green-900 text-xl font-bold mb-2">
    You&apos;re in the Queue!
  </AlertTitle>

  <AlertDescription className="flex flex-col items-center text-center w-full text-green-700 text-base space-y-2">
    <p>
      Thanks, <strong className="text-green-900">{queueInfo.name}</strong>! You are number{" "}
      <strong className="text-green-900 text-lg">{queueInfo.position}</strong> in the queue.
    </p>
    <p className="text-sm text-green-600">
      We’ll send you an SMS when it’s your turn.
      <br />
      You can also check your position manually if you wish.
    </p>

    <div className="mt-3 w-full flex justify-center">
      <Dialog open={isCheckStatusDialogOpen} onOpenChange={setIsCheckStatusDialogOpen}>
        <DialogTrigger asChild>
          {/* Changed from Button to text link */}
          <span
            className="cursor-pointer text-sm text-green-700 underline hover:text-green-800 transition-colors"
            onClick={() => setIsCheckStatusDialogOpen(true)} // Manually open dialog since not a button
          >
            Check your position now
          </span>
        </DialogTrigger>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Check Your Status</DialogTitle>
            <DialogDescription className="text-sm">
              Enter the name and phone number you used to join.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckPosition} className="space-y-3 mt-2 flex flex-col items-center">
            <div className="grid gap-1 w-full max-w-sm text-left">
              <Label htmlFor="check-name" className="text-sm">Your Name</Label>
              <Input
                id="check-name"
                value={checkName}
                onChange={(e) => setCheckName(e.target.value)}
                placeholder="Full Name"
                required
                className="text-sm"
              />
            </div>
            <div className="grid gap-1 w-full max-w-sm text-left">
              <Label htmlFor="check-phone" className="text-sm">Your Phone</Label>
              <Input
                id="check-phone"
                type="tel"
                placeholder="e.g., 0412 345 678"
                value={checkPhone}
                onChange={(e) => setCheckPhone(e.target.value)}
                required
                className="text-sm"
              />
            </div>
            <Button type="submit" className="w-full max-w-sm text-sm" disabled={isChecking}>
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...
                </>
              ) : (
                "Check Status"
              )}
            </Button>
          </form>
          {checkedPositionInfo && (
            <Alert className="mt-4 bg-green-50 border-green-200 shadow-inner">
              <AlertDescription className="text-sm text-center text-green-700">
                {checkedPositionInfo}
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </div>
  </AlertDescription>
</Alert>

  <div className="mt-8 flex justify-center">
    <Button
      onClick={resetForm}
      className="px-6 py-3 text-base md:text-lg font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md hover:from-emerald-600 hover:to-green-700 hover:scale-[1.02] transition-all duration-200"
    >
      Start New Entry
    </Button>
  </div>
</motion.div>
      ) : bookingConfirmation ? (
        // Appointment Booking Success Message
        <motion.div
  variants={fadeIn}
  initial="initial"
  animate="animate"
  className="mt-8"
>
  <Alert className="mt-6 bg-green-100 border-green-300 text-center p-6 shadow-lg rounded-xl animate-fade-in animate-once">
    <AlertTitle className="text-green-900 text-xl font-bold mb-2">
      Appointment Booked!
    </AlertTitle>
    <AlertDescription className="flex flex-col items-center text-center w-full text-green-700 text-base space-y-2">
      <p>
        Thanks,{" "}
        <strong className="text-green-900">{bookingConfirmation.clientName}</strong>! Your appointment for{" "}
        <br />
        <strong className="text-green-900 text-lg">
          {bookingConfirmation.dateTime}
        </strong>{" "}
        with{" "}
        <strong className="text-green-900">
          {bookingConfirmation.barberName}
        </strong>{" "}
        is confirmed.
      </p>
      <p className="text-sm text-green-600">
        We look forward to seeing you!
      </p>
      <div className="mt-3 w-full flex justify-center">
        <Button
          onClick={resetForm}
          className="px-6 py-3 text-base font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md hover:from-emerald-600 hover:to-green-700 hover:scale-[1.02] transition-all duration-200"
        >
          Book Another Appointment
        </Button>
      </div>
    </AlertDescription>
  </Alert>
</motion.div>
      ) : (
        // Main Content: Mode Selection & Dynamic Form
        <>
          <motion.div
            className="mb-10 space-y-6 text-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            <motion.p variants={fadeIn} className="text-md md:text-lg text-gray-600 dark:text-gray-400">
              Choose your preferred way to book with us.
            </motion.p>
            <motion.div
              variants={fadeIn}
              className="flex flex-row flex-wrap justify-center gap-4 mt-4"
            >
              <Button
  size="sm"
  variant={mode === "queue" ? "default" : "outline"}
  className={`flex-1 basis-[45%] max-w-[calc(50%-0.5rem)] px-4 py-2 text-sm md:text-base font-semibold shadow-md transition-all duration-300 flex flex-col h-auto justify-center items-center text-center leading-tight
    ${
      mode === "queue"
        ? "bg-gradient-to-r from-[#ff0084] to-[#33001b] text-white scale-105 shadow-lg ring-2 ring-[#ff0084]/50"
        : "hover:bg-muted"
    }
    ${mode === "queue" && 'animate-pulse'}
  `}
  onClick={() => {
    setMode("queue");
    handleNextStepClick(1, servicesRef);
  }}
>
  <Clock className="mb-1 h-4 w-4 md:h-5 md:w-5" />
  <span>Quick Walk-in</span>
</Button>

<Button
  size="sm"
  variant={mode === "appointment" ? "default" : "outline"}
  className={`flex-1 basis-[45%] max-w-[calc(50%-0.5rem)] px-4 py-2 text-sm md:text-base font-semibold shadow-md transition-all duration-300 flex flex-col h-auto justify-center items-center text-center leading-tight
    ${
      mode === "appointment"
        ? "bg-gradient-to-r from-[#33001b] to-[#ff0084] text-white scale-105 shadow-lg ring-2 ring-[#ff0084]/50"
        : "hover:bg-muted"
    }
    ${mode === "appointment" && 'animate-pulse'}
  `}
  onClick={() => {
    setMode("appointment");
    handleNextStepClick(1, servicesRef);
  }}
>
  <CalendarDays className="mb-1 h-4 w-4 md:h-5 md:w-5" />
  <span>Scheduled Appointment</span>
</Button>

            </motion.div>
            <motion.div variants={fadeIn} className="mt-8">
              <Dialog
                open={isCheckStatusDialogOpen}
                onOpenChange={setIsCheckStatusDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="link" className="text-muted-foreground hover:text-primary transition-colors text-base">
                    Check my current status
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Check Your Status</DialogTitle>
                    <DialogDescription>
                      Enter the name and phone number you used to join.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCheckPosition} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="check-name">Your Name</Label>
                      <Input
                        id="check-name"
                        value={checkName}
                        onChange={(e) => setCheckName(e.target.value)}
                        placeholder="Full Name"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="check-phone">Your Phone</Label>
                      <Input
                        id="check-phone"
                        type="tel"
                        placeholder="e.g., 0412 345 678"
                        value={checkPhone}
                        onChange={(e) => setCheckPhone(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isChecking}
                    >
                      {isChecking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...
                        </>
                      ) : (
                        "Check Status"
                      )}
                    </Button>
                  </form>
                  {checkedPositionInfo && (
                    <Alert className="mt-4">
                      <AlertDescription>
                        {checkedPositionInfo}
                      </AlertDescription>
                    </Alert>
                  )}
                  <DialogFooter className="mt-4">
                    <DialogClose asChild>
                      <Button variant="ghost">
                        Close
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                  {/* Current time display inside dialog for context */}
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Current time in Bankstown: {format(new Date(), "h:mm a, EEE, MMM dd")}
                  </p>
                </DialogContent>
              </Dialog>
            </motion.div>
          </motion.div>

          {mode && ( // Only render the form if a mode is selected
            <form className="mt-12 space-y-12">
              {/* Step 1: Select Services (Common to both modes) */}
              {currentStep >= 1 && (
                <motion.div ref={servicesRef} className="space-y-6" variants={fadeInUp}>
                  <Card className="p-6 shadow-lg">
                    <CardHeader className="p-0 mb-4 flex-row justify-between items-center">
                      <CardTitle className="text-xl md:text-2xl font-bold flex items-center gap-2">
                        <ListChecks className="h-6 w-6 text-primary" /> 1. Select Service(s)
                      </CardTitle>
                      <p className="text-lg md:text-xl font-bold text-primary">
                        ${totalPrice.toFixed(2)}
                      </p>
                    </CardHeader>
                    <CardContent className="p-0">
                      {items.length > 0 ? (
                        <motion.div
                          className="flex flex-col gap-3"
                          variants={staggerContainer}
                        >
                          {Object.entries(categorizedServices).map(
                            ([category, servicesInCategory], index) => (
                              <Collapsible
                                key={category}
                                className="border rounded-lg overflow-hidden bg-background"
                                defaultOpen={index === 0}
                              >
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors rounded-t-lg">
                                    <h3 className="text-base md:text-lg font-bold text-gray-700">{category}</h3>
                                    <ChevronDown className="h-5 w-5 text-gray-500 ui-open:rotate-180 transition-transform" />
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="px-4 py-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {servicesInCategory.map((service) => (
                                      <motion.div
                                        key={service.id}
                                        variants={fadeIn}
                                        className="transition-transform hover:-translate-y-0.5"
                                      >
                                        <Button
                                          type="button"
                                          variant={
                                            selectedServices.some(
                                              (s) => s.id === service.id,
                                            )
                                              ? "default"
                                              : "outline"
                                          }
                                          onClick={() => handleServiceSelect(service)}
                                          className="w-full flex flex-col h-auto items-start p-4 text-left transition-colors text-wrap whitespace-normal text-start"
                                        >
                                          <span className="font-semibold text-sm md:text-base">
                                            {service.name} (${service.price.toFixed(2)})
                                          </span>
                                          {service.description && (
                                            <span className="text-xs text-muted-foreground mt-1 text-wrap">
                                              {service.description}
                                            </span>
                                          )}
                                          <span className="text-xs text-muted-foreground mt-1">
                                            <Timer className="inline-block h-3 w-3 mr-1" />
                                            {service.duration_minutes} min
                                          </span>
                                        </Button>
                                      </motion.div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            ),
                          )}
                        </motion.div>
                      ) : (
                        <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground text-lg">
                          No services available at this time.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  {/* Next Step Button for Services */}
                  <div className="flex justify-center mt-6">
                    <motion.div
                      className="cursor-pointer p-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      initial={{ y: 0 }}
                      animate={selectedServices.length > 0 ? { y: [0, 5, 0] } : {}}
                      transition={selectedServices.length > 0 ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
                      onClick={() => handleNextStepClick(currentStep + 1, barberRef)}
                      style={{ opacity: selectedServices.length > 0 ? 1 : 0.5, pointerEvents: selectedServices.length > 0 ? 'auto' : 'none' }}
                      title={selectedServices.length === 0 ? "Select at least one service to continue" : "Next Step"}
                    >
                      <ChevronDown className="h-8 w-8" />
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* Conditional Step 2 for QUEUE: Select Staff */}
              {mode === "queue" && currentStep >= 2 && (
  <motion.div ref={barberRef} className="space-y-6" variants={fadeInUp}>
    <Card className="p-6 shadow-lg">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-primary" /> 2. Choose Your Barber
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {staffMembers.length > 0 ? (
          <>
            {/* Updated "Any Barber" button styling */}
            <div className="mb-6 flex justify-center">
              <Button
                type="button"
                // Using a custom class for gradient and hover effects
                className="px-6 py-3 text-base md:text-lg font-semibold rounded-xl text-white
                           bg-gradient-to-r from-purple-600 to-indigo-700
                           shadow-md hover:from-purple-700 hover:to-indigo-800
                           transition-all duration-300 transform hover:scale-105
                           flex items-center justify-center gap-2" // Added flex for icon + text
                onClick={() => {
                  const availableBarbers = staffMembers.filter(b => !b.is_on_break);
                  if (availableBarbers.length > 0) {
                    const bestBarber = availableBarbers.sort((a, b) => {
                      const aWaitTime = waitTimes[a.id] || 0;
                      const bWaitTime = waitTimes[b.id] || 0;
                      if (aWaitTime !== bWaitTime) {
                        return aWaitTime - bWaitTime;
                      }
                      const aWaitingCount = waitingCounts[a.id] || 0;
                      const bWaitingCount = waitingCounts[b.id] || 0;
                      return aWaitingCount - bWaitingCount;
                    })[0];
                    setSelectedBarber(bestBarber);
                  } else {
                    alert("No barbers available right now. Please try again later.");
                  }
                }}
              >
                <Shuffle className="h-5 w-5" /> {/* Add a suitable icon */}
                <span>Choose Any Available Barber</span>
              </Button>
            </div>

            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
              variants={staggerContainer}
            >
              {staffMembers.map((barber) => {
                const waitingCount = waitingCounts[barber.id] || 0;
                const waitTime = waitTimes[barber.id] || 0;
                return (
                  <motion.div
                    key={barber.id}
                    variants={fadeIn}
                    className="relative"
                  >
                    {barber.is_on_break && (
                      <div className="absolute inset-0 bg-black/60 rounded-lg z-10 flex items-center justify-center backdrop-blur-sm">
                        <Badge variant="destructive" className="text-lg px-4 py-2">ON BREAK</Badge>
                      </div>
                    )}
                    <Card
                      className={`cursor-pointer transition-all h-full bg-card border-2 hover:border-primary/80 ${selectedBarber?.id === barber.id ? "border-primary ring-2 ring-primary/50 shadow-md" : "border-border"}`}
                      onClick={() =>
                        !barber.is_on_break && setSelectedBarber(barber)
                      }
                    >
                      <CardContent className="flex flex-col items-center justify-center p-4 gap-2 text-center">
                        <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-primary/50 shadow-sm">
                          <AvatarImage
                            src={barber.avatar_url || undefined}
                            alt={barber.name}
                          />
                          <AvatarFallback className="text-lg md:text-xl font-bold bg-primary/20 text-primary-foreground">
                            {barber.name
                              .split(" ")
                              .map((n) => n?.[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-semibold text-base md:text-lg mt-2">{barber.name}</p>
                        <Badge
                          variant={
                            waitingCount > 0 ? "default" : "secondary"
                          }
                          className="mt-1 text-sm py-1 px-3 transition-colors"
                        >
                          {waitingCount} waiting
                        </Badge>
                        {waitTime > 0 && (
                          <div className="flex items-center justify-center gap-1 text-xs md:text-sm text-muted-foreground mt-1.5">
                            <Timer className="h-4 w-4" />~{waitTime} min wait
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        ) : (
          <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground text-lg">
            No staff members available for walk-ins right now.
          </div>
        )}
      </CardContent>
    </Card>
    {/* Next Step Button for Staff (Queue) */}
    <div className="flex justify-center mt-6">
      <motion.div
        className="cursor-pointer p-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        whileHover={{ scale: 1.1 }}
        initial={{ y: 0 }}
        animate={selectedBarber ? { y: [0, 5, 0] } : {}}
        transition={selectedBarber ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
        onClick={() => handleNextStepClick(currentStep + 1, detailsRef)}
        style={{ opacity: selectedBarber ? 1 : 0.5, pointerEvents: selectedBarber ? 'auto' : 'none' }}
        title={selectedBarber ? "Next Step" : "Select a barber to continue"}
      >
        <ChevronDown className="h-8 w-8" />
      </motion.div>
    </div>
  </motion.div>
)}

              {/* Conditional Step 2 for APPOINTMENT: Select Staff */}
              {mode === "appointment" && currentStep >= 2 && (
                <motion.div ref={barberRef} className="space-y-6" variants={fadeInUp}>
                  <Card className="p-6 shadow-lg">
                    <CardHeader className="p-0 mb-4">
                      <CardTitle className="text-xl md:text-2xl font-bold flex items-center gap-2">
                        <User className="h-6 w-6 text-primary" /> 2. Select a Staff Member
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {staffMembers.length > 0 ? (
                        <motion.div
                          className="grid grid-cols-2 md:grid-cols-3 gap-4"
                          variants={staggerContainer}
                        >
                          {staffMembers.map((barber) => {
                            return (
                              <motion.div
                                key={barber.id}
                                variants={fadeIn}
                                className="relative"
                              >
                                {barber.is_on_break && (
                                  <div className="absolute inset-0 bg-black/60 rounded-lg z-10 flex items-center justify-center backdrop-blur-sm">
                                    <Badge variant="destructive" className="text-lg px-4 py-2">ON BREAK</Badge>
                                  </div>
                                )}
                                <Card
                                  className={`cursor-pointer transition-all h-full bg-card border-2 hover:border-primary/80 ${selectedBarber?.id === barber.id ? "border-primary ring-2 ring-primary/50 shadow-md" : "border-border"}`}
                                  onClick={() =>
                                    !barber.is_on_break && setSelectedBarber(barber)
                                  }
                                >
                                  <CardContent className="flex flex-col items-center justify-center p-4 gap-2 text-center">
                                    <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-primary/50 shadow-sm">
                                      <AvatarImage
                                        src={barber.avatar_url || undefined}
                                        alt={barber.name}
                                      />
                                      <AvatarFallback className="text-lg md:text-xl font-bold bg-primary/20 text-primary-foreground">
                                        {barber.name
                                          .split(" ")
                                          .map((n) => n?.[0])
                                          .join("")}
                                      </AvatarFallback>
                                    </Avatar>
                                    <p className="font-semibold text-base md:text-lg mt-2">{barber.name}</p>
                                    {!barber.is_on_break && (
                                        <Badge variant="secondary" className="mt-1 text-sm py-1 px-3">Available for Booking</Badge>
                                    )}
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      ) : (
                        <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground text-lg">
                          No staff members available for booking.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  {/* Next Step Button for Staff (Appointment) */}
                  <div className="flex justify-center mt-6">
                    <motion.div
                      className="cursor-pointer p-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      initial={{ y: 0 }}
                      animate={selectedBarber ? { y: [0, 5, 0] } : {}}
                      transition={selectedBarber ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
                      onClick={() => handleNextStepClick(currentStep + 1, dateTimeRef)} // Go to date/time ref next
                      style={{ opacity: selectedBarber ? 1 : 0.5, pointerEvents: selectedBarber ? 'auto' : 'none' }}
                      title={selectedBarber ? "Next Step" : "Select a barber to continue"}
                    >
                      <ChevronDown className="h-8 w-8" />
                    </motion.div>
                  </div>
                </motion.div>
              )}


              {mode === "appointment" && currentStep >= 3 && selectedBarber && ( // Only show if barber is selected
                <motion.div ref={dateTimeRef} className="space-y-6" variants={fadeInUp}>
                  <Card className="p-6 shadow-lg">
                    <CardHeader className="p-0 mb-4">
                      <CardTitle className="text-xl md:text-2xl font-bold flex items-center gap-2">
                        <CalendarDays className="h-6 w-6 text-primary" /> 3. Select Date & Time
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Date Picker */}
                        <Card className="shadow-sm">
                          <CardHeader className="border-b px-4 py-3">
                            <CardTitle className="text-base md:text-lg flex items-center gap-2">
                              <CalendarDays className="h-5 w-5 text-primary" />
                              Select a Date
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="flex justify-center p-4">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={setSelectedDate}
                              disabled={(date) =>
                                isBefore(date, addDays(new Date(), -1)) ||
                                isAfter(date, addDays(new Date(), 60))
                              }
                              initialFocus
                              className="rounded-md border"
                            />
                          </CardContent>
                        </Card>

                        {/* Time Slots */}
                        <Card className="shadow-sm">
                          <CardHeader className="border-b px-4 py-3">
                            <CardTitle className="text-base md:text-lg flex items-center gap-2">
                              <Clock className="h-5 w-5 text-primary" />
                              Select a Time Slot
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4">
                            {!selectedDate || selectedServices.length === 0 ? (
                              <p className="text-muted-foreground text-center py-6 text-sm md:text-base">
                                Select a date and at least one service to see available slots.
                              </p>
                            ) : loadingSlots ? (
                              <p className="text-muted-foreground text-center py-6 text-sm md:text-base flex items-center justify-center">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />{" "}
                                Loading slots...
                              </p>
                            ) : availableSlots.length > 0 ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {availableSlots.map((slot, index) => (
                                  <Button
                                    key={index}
                                    type="button"
                                    variant={
                                      selectedSlot?.barber_id === slot.barber_id &&
                                      selectedSlot?.time === slot.time
                                        ? "default"
                                        : "outline"
                                    }
                                    onClick={() => {
                                      setSelectedSlot(slot);
                                      // IMPORTANT CHANGE: Automatically advance to step 4 (Your Details)
                                      handleNextStepClick(4, detailsRef);
                                    }}
                                    className="flex flex-col h-auto items-center p-2 text-center text-xs md:text-sm transition-colors"
                                  >
                                    <span className="font-medium">{slot.time}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {slot.barber_name}
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground text-center py-6 text-sm md:text-base">
                                No available slots for the selected date/services with{" "}
                                <strong className="text-primary">{selectedBarber.name}</strong>.
                                Try another day or different services.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
                  {/* REMOVED: Next Step Button for Date & Time (Appointment) */}
                  {/* The motion.div with ChevronDown icon is removed from here */}
                </motion.div>
              )}

              {/* Step 3 (for queue) or 4 (for appointment): Your Details (Common to both modes) */}
              {((mode === "queue" && currentStep >= 3 && selectedBarber) || (mode === "appointment" && currentStep >= 4 && selectedSlot)) && (
  <motion.div ref={detailsRef} className="space-y-6" variants={fadeInUp}>
    <Card className="p-6 shadow-lg">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-primary" /> {mode === "queue" ? "3. Your Details" : "4. Your Details"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="client-name" className="font-medium text-gray-700">Your Name</Label> {/* Enhanced label color */}
            <Input
              id="client-name"
              placeholder="e.g., Jane Doe"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              // Enhanced Input Field Styling
              className="p-2 border border-input bg-background rounded-md shadow-sm
                         focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none
                         transition-all duration-200 text-base" // Added text-base for consistency
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-phone" className="font-medium text-gray-700">Your Phone</Label> {/* Enhanced label color */}
            <div className="relative">
              <Input
                id="client-phone"
                type="tel"
                placeholder="e.g., 0412 345 678"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                required
                // Enhanced Input Field Styling (same as above)
                className="p-2 pl-10 border border-input bg-background rounded-md shadow-sm
                           focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none
                           transition-all duration-200 text-base"
              />
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {!isValidAustralianPhone(clientPhone) && clientPhone.length > 0 && (
              <p className="text-sm text-destructive mt-1">
                Please enter a valid 10-digit Australian phone number.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
                  {/* Submit Button (Changes based on mode) */}
                  <motion.div variants={fadeIn} className="mt-10 flex justify-center">
                    <Button
  type="submit"
  size="lg"
  className={`px-6 py-3 text-lg md:text-xl font-semibold text-white
    bg-gradient-to-r from-emerald-500 to-green-600 // Changed to green gradient

    transition-all duration-300 transform hover:scale-105
    shadow-lg ring-2 ring-emerald-500/50 rounded-xl // Updated ring color
  `}
  disabled={
    loading ||
    isSubmitting ||
    selectedServices.length === 0 ||
    !clientName ||
    !clientPhone ||
    (mode === "appointment" && !selectedSlot) ||
    (mode === "queue" && !selectedBarber) ||
    !isValidAustralianPhone(clientPhone)
  }
  onClick={mode === "queue" ? handleJoinQueue : handleBookAppointment}
>
  {isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
    </>
  ) : mode === "queue" ? (
    "Join the Queue"
  ) : (
    "Book Your Appointment"
  )}
</Button>




                  </motion.div>
                </motion.div>
              )}
            </form>
          )}
        </>
      )}
      <footer className="mt-16 py-6 text-center text-gray-300 text-2xl font-bold"> {/* Changed text-2xl to text-3xl for bigger, removed text-primary */}
  <p>WaitWise</p>
</footer>
    </div>
  );
}