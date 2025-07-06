// supabase/functions/notify-customer/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts"; // Assuming you have this shared file

// Clicksend API endpoint for sending SMS
const CLICKSEND_API_URL = "https://rest.clicksend.com/v3/sms/send";

Deno.serve(async (req) => {
  // This is a standard step to handle preflight requests from browsers
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // MODIFIED STEP 1: Get type and generic entity_id from the request
    const { entity_id, type } = await req.json(); // type: 'queue' | 'order'
    if (!entity_id || !type) {
      throw new Error("Missing entity_id or type in request body");
    }

    // Step 2: Retrieve your Clicksend credentials from the secrets
    const clicksendUsername = Deno.env.get("CLICKSEND_USERNAME");
    const clicksendApiKey = Deno.env.get("CLICKSEND_API_KEY");
    const clicksendFromNumber = Deno.env.get("CLICKSEND_FROM_NUMBER");

    if (!clicksendUsername || !clicksendApiKey || !clicksendFromNumber) {
      throw new Error(
        "Clicksend API credentials are not set in Supabase secrets.",
      );
    }

    // Step 3: Create a special Supabase client that can override security rules
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let clientPhone: string | null = null;
    let notificationSentAt: string | null = null;
    let messageBody: string = "";
    let updateTable: string = "";
    let updateColumn: string = "";

    // MODIFIED STEP 4 & 6: Conditional Fetch and Message Creation
    if (type === 'queue') {
      const { data: queueEntry, error: fetchError } = await supabaseAdmin
        .from("queue_entries")
        .select(
          `
          client_phone,
          notification_sent_at,
          barbers ( name ),
          shops ( name )
        `,
        )
        .eq("id", entity_id)
        .single();

      if (fetchError) throw fetchError;
      if (!queueEntry) throw new Error("Queue entry not found.");

      clientPhone = queueEntry.client_phone;
      notificationSentAt = queueEntry.notification_sent_at;
      const barberName = queueEntry.barbers?.name || "the barber";
      const shopName = queueEntry.shops?.name || "the shop"; // Default changed for clarity
      messageBody = `Hi from ${shopName}! You are now first in the queue for ${barberName}. Please make your way to the shop. Do not reply.`;
      updateTable = "queue_entries";
      updateColumn = "notification_sent_at";

    } else if (type === 'order') {
      // For food truck orders, we need client_phone and a status like 'order_ready_notified_at'
      // You might need to add a column like `order_ready_notified_at TIMESTAMPZ` to your 'orders' table
      const { data: order, error: fetchError } = await supabaseAdmin
        .from("orders")
        .select(
          `
          client_phone,
          shop_id,
          order_ready_notified_at,
          shops ( name )
        `,
        )
        .eq("id", entity_id)
        .single();

      if (fetchError) throw fetchError;
      if (!order) throw new Error("Order not found.");

      clientPhone = order.client_phone;
      notificationSentAt = order.order_ready_notified_at; // Use the new column
      const shopName = order.shops?.name || "the food truck";
      messageBody = `Hi from ${shopName}! Your order is ready for pickup. Please head over to collect it. Do not reply.`;
      updateTable = "orders";
      updateColumn = "order_ready_notified_at"; // The column to update

    } else {
      throw new Error("Invalid notification type specified.");
    }

    // Common Step: Check if notification has already been sent (using the dynamically fetched value)
    if (notificationSentAt) {
      console.log(`Notification already sent for ${type} ID ${entity_id}. Skipping.`);
      return new Response(
        JSON.stringify({ message: `Notification already sent for ${type} ID ${entity_id}.` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }
    
    // MODIFIED: Skip SMS if clientPhone is missing or invalid
    if (!clientPhone || clientPhone.trim() === '' || !/^\+?\d{8,14}$/.test(clientPhone.trim().replace(/\s/g, ''))) { // Basic global phone number validation
      console.log(`Skipping SMS for ${type} ID ${entity_id}: Client phone number not available or invalid.`);
      return new Response(
        JSON.stringify({ message: `SMS skipped for ${type} ID ${entity_id}: Phone number not provided or invalid.` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }


    // Step 7: Prepare the request for the Clicksend API
    const authHeader = `Basic ${btoa(clicksendUsername + ":" + clicksendApiKey)}`;
    const payload = {
      messages: [
        {
          source: "supabase",
          body: messageBody,
          to: clientPhone, // Use the dynamically fetched clientPhone
          from: clicksendFromNumber,
        },
      ],
    };

    // Step 8: Send the request to Clicksend to send the SMS
    const response = await fetch(CLICKSEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok || responseData.response_code !== "SUCCESS") {
      console.error("Clicksend API response:", responseData); // Log full response for debugging
      throw new Error(`Clicksend API Error: ${responseData.response_msg || 'Unknown error'}`);
    }

    // MODIFIED STEP 9: If the SMS was sent successfully, update the correct database table and column
    const updatePayload = { [updateColumn]: new Date().toISOString() };
    const { error: updateError } = await supabaseAdmin
      .from(updateTable)
      .update(updatePayload)
      .eq("id", entity_id);

    if (updateError) {
      console.error(`Error updating ${updateTable}.${updateColumn} for ${entity_id}:`, updateError);
      // This is a non-fatal error for the SMS, but crucial for tracking.
      // We'll still return success for the SMS send.
    }

    // Step 10: Send back a success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `SMS sent to ${clientPhone} for ${type} ID ${entity_id}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    // If anything goes wrong, send back an error response
    console.error("Notify customer Edge Function error:", error); // Log original error
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});