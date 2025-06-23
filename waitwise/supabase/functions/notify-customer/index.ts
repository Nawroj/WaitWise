import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Clicksend API endpoint for sending SMS
const CLICKSEND_API_URL = 'https://rest.clicksend.com/v3/sms/send';

Deno.serve(async (req) => {
  // This is a standard step to handle preflight requests from browsers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Step 1: Get the ID of the queue entry from the request
    const { queue_entry_id } = await req.json();
    if (!queue_entry_id) {
      throw new Error("Missing queue_entry_id in request body");
    }

    // Step 2: Retrieve your Clicksend credentials from the secrets we set earlier
    const clicksendUsername = Deno.env.get("CLICKSEND_USERNAME");
    const clicksendApiKey = Deno.env.get("CLICKSEND_API_KEY");
    const clicksendFromNumber = Deno.env.get("CLICKSEND_FROM_NUMBER");

    if (!clicksendUsername || !clicksendApiKey || !clicksendFromNumber) {
      throw new Error("Clicksend API credentials are not set in Supabase secrets.");
    }

    // Step 3: Create a special Supabase client that can override security rules
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // Step 4: Fetch the customer's details from the database
    const { data: queueEntry, error: fetchError } = await supabaseAdmin
      .from('queue_entries')
      .select(`
        client_phone,
        notification_sent_at,
        barbers ( name ),
        shops ( name )
      `)
      .eq('id', queue_entry_id)
      .single();

    if (fetchError) throw fetchError;

    // Step 5: IMPORTANT - Check if a notification has already been sent to prevent spam
    if (queueEntry.notification_sent_at) {
      return new Response(JSON.stringify({ message: "Notification has already been sent." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Step 6: Create the SMS message
    const barberName = queueEntry.barbers?.name || 'the shop';
    const shopName = queueEntry.shops?.name || 'WaitWise';
    const messageBody = `Hi from ${shopName}! You are now first in the queue for ${barberName}. Please make your way to the shop. Do not reply.`;

    // Step 7: Prepare the request for the Clicksend API
    const authHeader = `Basic ${btoa(clicksendUsername + ':' + clicksendApiKey)}`;
    const payload = {
      messages: [{
        source: "supabase",
        body: messageBody,
        to: queueEntry.client_phone,
        from: clicksendFromNumber
      }]
    };

    // Step 8: Send the request to Clicksend to send the SMS
    const response = await fetch(CLICKSEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (response.status !== 200 || responseData.response_code !== "SUCCESS") {
       throw new Error(`Clicksend API Error: ${responseData.response_msg}`);
    }

    // Step 9: If the SMS was sent successfully, update our database
    await supabaseAdmin
      .from('queue_entries')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', queue_entry_id);

    // Step 10: Send back a success response
    return new Response(JSON.stringify({ success: true, message: `SMS sent to ${queueEntry.client_phone}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // If anything goes wrong, send back an error response
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});