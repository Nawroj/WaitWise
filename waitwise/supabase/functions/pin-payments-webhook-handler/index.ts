import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { timingSafeEqual } from "https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

console.log("Webhook handler function initialized with verification.");

// This helper function verifies the webhook signature
async function verifySignature(secret: string, headers: Headers, body: string): Promise<boolean> {
  const timestamp = headers.get('Pin-Signature-Timestamp');
  const signature = headers.get('Pin-Signature');
  
  if (!timestamp || !signature) {
    console.error("Missing signature headers");
    return false;
  }

  const signedPayload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expectedSignature = new TextDecoder().decode(encode(new Uint8Array(mac)));

  // Use timingSafeEqual to prevent timing attacks
  return timingSafeEqual(
    new TextEncoder().encode(expectedSignature),
    new TextEncoder().encode(signature)
  );
}


serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
  }

  // We need the raw text body for signature verification, so we clone the request
  const rawBody = await req.clone().text();
  const headers = req.headers;
  
  try {
    // 1. Verify the signature
    const webhookSecret = Deno.env.get('PIN_WEBHOOK_SECRET');
    if (!webhookSecret) throw new Error("Webhook secret is not set in environment variables.");

    const isVerified = await verifySignature(webhookSecret, headers, rawBody);
    if (!isVerified) {
      console.warn("Webhook signature verification failed.");
      return new Response("Unauthorized", { status: 401 });
    }
    console.log("✅ Webhook signature verified successfully.");

    // 2. Process the event payload
    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    const eventData = payload.data;

    console.log(`Processing event: ${eventType}`);

    // Create a Supabase client with the service role key to perform admin actions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 3. Add logic for specific events
    switch (eventType) {
      case 'charge.dispute.created':
        const chargeToken = eventData.charge_token;
        console.log(`Chargeback received for charge: ${chargeToken}`);

        // Find the invoice related to this charge
        const { data: invoice, error: invoiceError } = await supabaseAdmin
          .from('invoices')
          .select('id, shop_id')
          .eq('charge_token', chargeToken)
          .single();
        
        if (invoiceError) throw new Error(`Error finding invoice for charge ${chargeToken}: ${invoiceError.message}`);

        if (invoice) {
          // Update the invoice status to 'disputed'
          await supabaseAdmin
            .from('invoices')
            .update({ status: 'disputed', error_message: 'Chargeback initiated by customer.' })
            .eq('id', invoice.id);
          
          // Update the shop's subscription status to 'on_hold' or 'past_due'
          await supabaseAdmin
            .from('shops')
            .update({ subscription_status: 'past_due' })
            .eq('id', invoice.shop_id);
          
          console.log(`Successfully processed dispute for shop ${invoice.shop_id}`);
        }
        break;

      // You can add more cases here for other events like 'transfer.failed'

      default:
        console.log(`- Unhandled event type: ${eventType}`);
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (error) {
    console.error("Error processing webhook:", error.message);
    return new Response(JSON.stringify({ error: "Failed to process webhook" }), { status: 400 });
  }
})