// supabase/functions/retry-payment/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import Stripe from 'npm:stripe@18.2.1';

console.log('*** retry-payment Edge Function starting up ***');

// Initialize Supabase client for database interaction
// IMPORTANT: Use SUPABASE_SERVICE_ROLE_KEY for write operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string // <-- CRITICAL: Use SERVICE_ROLE_KEY
);

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-05-28.basil',
});

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific origins like 'http://localhost:3000' in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // Crucial: allow x-client-info
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS for preflight
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[retry-payment] Handling OPTIONS preflight request.');
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`[retry-payment] Method Not Allowed: ${req.method}`);
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Include CORS headers
      status: 405,
    });
  }

  try {
    const { shop_id } = await req.json();
    console.log(`[retry-payment] Request received for shop_id: ${shop_id}`);

    if (!shop_id) {
      console.log('[retry-payment] Missing shop_id in request body.');
      return new Response(JSON.stringify({ error: 'Missing shop_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 1. Fetch shop data to get stripe_customer_id
    console.log(`[retry-payment] Fetching shop data for ${shop_id}`);
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('stripe_customer_id')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop || !shop.stripe_customer_id) {
      console.error(`[retry-payment] Error fetching shop or missing Stripe customer ID for ${shop_id}:`, shopError?.message || 'Shop or customer ID not found');
      return new Response(JSON.stringify({ error: 'Shop not found or Stripe customer ID missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }
    const stripeCustomerId = shop.stripe_customer_id;
    console.log(`[retry-payment] Found Stripe Customer ID: ${stripeCustomerId}`);

    // 2. Fetch the latest failed invoice for this customer from your Supabase 'invoices' table
    console.log(`[retry-payment] Fetching latest failed invoice for customer ${stripeCustomerId} (shop ${shop_id})`);
    const { data: latestFailedInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, stripe_invoice_id, amount_due')
      .eq('shop_id', shop_id)
      .eq('status', 'failed')
      .order('created_at', { ascending: false }) // Use created_at for ordering consistency
      .limit(1)
      .single();

    if (invoiceError || !latestFailedInvoice || !latestFailedInvoice.stripe_invoice_id) {
      console.warn(`[retry-payment] No failed invoice found in Supabase for shop_id: ${shop_id}. Error:`, invoiceError?.message);
      return new Response(JSON.stringify({ error: 'No outstanding failed invoice found to retry for this shop.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }
    const stripeInvoiceId = latestFailedInvoice.stripe_invoice_id;
    const localInvoiceId = latestFailedInvoice.id;
    console.log(`[retry-payment] Found local failed invoice ID: ${localInvoiceId}, Stripe Invoice ID: ${stripeInvoiceId}`);


    let stripeInvoice;
    try {
      // 3. Retrieve the invoice from Stripe
      console.log(`[retry-payment] Retrieving invoice ${stripeInvoiceId} from Stripe.`);
      stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);
      console.log(`[retry-payment] Stripe Invoice retrieved. Status: ${stripeInvoice.status}, Amount: ${stripeInvoice.amount_due}`);

      // Check if the invoice is already paid or open
      if (stripeInvoice.status === 'paid') {
        console.log(`[retry-payment] Invoice ${stripeInvoiceId} already paid in Stripe. Updating DB.`);
        await supabase
          .from('invoices')
          .update({ status: 'paid', amount_paid: latestFailedInvoice.amount_due })
          .eq('id', localInvoiceId);
        await supabase
          .from('shops')
          .update({ subscription_status: 'active', account_balance: 0 })
          .eq('id', shop_id);
        return new Response(JSON.stringify({ message: 'Invoice already paid.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      // If the invoice is not 'open', it might be 'void' or 'uncollectible'.
      if (stripeInvoice.status !== 'open') {
        console.warn(`[retry-payment] Invoice ${stripeInvoiceId} is not 'open' (current status: ${stripeInvoice.status}). Cannot retry payment.`);
        return new Response(JSON.stringify({ error: `Invoice status is ${stripeInvoice.status}. Cannot retry payment.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

    } catch (stripeRetrieveError: any) {
      console.error(`[retry-payment] Error retrieving invoice ${stripeInvoiceId} from Stripe:`, stripeRetrieveError.message);
      return new Response(JSON.stringify({ error: `Failed to retrieve invoice from Stripe: ${stripeRetrieveError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let paymentResult;
    try {
      // 4. Attempt to pay the invoice
      console.log(`[retry-payment] Attempting to pay Stripe Invoice ${stripeInvoiceId} automatically.`);
      paymentResult = await stripe.invoices.pay(stripeInvoiceId, {
        off_session: true, // <-- FIXED: Changed from offSession to off_session
      });
      console.log(`[retry-payment] Stripe Invoice pay attempt finished. Result status: ${paymentResult.status}`);

    } catch (stripePayError: any) {
      console.error(`[retry-payment] Error paying invoice with Stripe for ${stripeInvoiceId}:`, stripePayError.message, `Raw error: ${JSON.stringify(stripePayError.raw)}`);

      // Handle specific Stripe error types for better frontend feedback
      let errorMessage = 'Failed to process payment. Please try again or update your payment method.';
      if (stripePayError.raw && stripePayError.raw.code) {
        if (stripePayError.raw.code === 'card_declined') {
          errorMessage = 'Payment declined. Please update your payment method.';
        } else if (stripePayError.raw.code === 'missing_payment_method') {
          errorMessage = 'No payment method on file. Please add one.';
        } else if (stripePayError.raw.message) {
          errorMessage = stripePayError.raw.message; // Use Stripe's detailed message
        }
      }
      console.log(`[retry-payment] Payment failed during pay call. Frontend error message: ${errorMessage}`);

      // Update invoice status in DB to 'failed' again, or add a specific error reason
      await supabase
        .from('invoices')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', localInvoiceId);

      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 5. Update Supabase database based on payment outcome
    if (paymentResult.status === 'paid') {
      console.log(`[retry-payment] Payment result is 'paid'. Updating DB for invoice ${localInvoiceId} and shop ${shop_id}.`);
      const { error: updateInvoiceError } = await supabase
        .from('invoices')
        .update({ status: 'paid', amount_paid: paymentResult.amount_paid, stripe_charge_id: paymentResult.charge as string || null })
        .eq('id', localInvoiceId);

      if (updateInvoiceError) {
        console.error(`[retry-payment] Error updating invoice status to paid in DB for ${localInvoiceId}:`, updateInvoiceError);
      }

      // Update shop subscription status to active and reset balance
      const { error: updateShopError } = await supabase
        .from('shops')
        .update({ subscription_status: 'active', account_balance: 0 })
        .eq('id', shop_id);

      if (updateShopError) {
        console.error(`[retry-payment] Error updating shop subscription status/balance in DB for ${shop_id}:`, updateShopError);
      }

      return new Response(JSON.stringify({ message: 'Payment successful!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else if (paymentResult.status === 'requires_action') {
      // Handle 3D Secure / SCA or other required actions
      // You would typically redirect the user to complete this action on the frontend.
      // For now, we'll return an error indicating action is needed.
      console.log(`[retry-payment] Payment result is 'requires_action'. Invoice ${stripeInvoiceId} requires further action.`);
      const errorMessage = 'Payment requires further action (e.g., 3D Secure verification). Please try updating your payment method.';
      await supabase
        .from('invoices')
        .update({ status: 'requires_action', error_message: errorMessage }) // Add 'requires_action' to invoice status type if needed
        .eq('id', localInvoiceId);

      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    else {
      // Any other non-paid status means a failure from the user's perspective.
      console.log(`[retry-payment] Payment result is unexpected status: ${paymentResult.status}. Marking as failed.`);
      const errorMessage = `Payment attempt resulted in status: ${paymentResult.status}`;
      await supabase
        .from('invoices')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', localInvoiceId);

      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

  } catch (error: any) {
    console.error(`[retry-payment] Unexpected error in function execution:`, error.message, error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected server error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
