// supabase/functions/process-monthly-invoices/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'; // Ensure this matches your Supabase client version
import Stripe from 'npm:stripe@18.2.1'; // Ensure this matches the Stripe version you installed

console.log('Hello from process-monthly-invoices Edge Function!');

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-05-28.basil', // Use a recent stable API version
});

serve(async (req) => {
  // --- SECURITY CHECK (CRUCIAL if triggered externally or manually) ---
  // If you are triggering this function via an external cron service (e.g., cron-job.org)
  // or manually via 'curl' with a secret header, uncomment and configure this.
  // If relying solely on Supabase's internal cron scheduler (which should be configured
  // to directly invoke the function, not its HTTP endpoint), this might not be strictly
  // necessary as Supabase's internal scheduler handles authentication, but it's good for defense-in-depth.
  /*
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  if (!CRON_SECRET || req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    console.warn('Unauthorized attempt to invoke process-monthly-invoices.');
    return new Response('Unauthorized', { status: 401 });
  }
  */

  // Allow OPTIONS preflight requests for development/testing if needed
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*', // Restrict this to your frontend domain(s) in production
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {
    // Initialize Supabase client with the service role key for full database access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          persistSession: false // Do not persist session for server-side operations
        }
      }
    );

    // --- 1. Determine the previous month's date range in UTC ---
    const today = new Date();
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth(); // 0-indexed (e.g., 5 for June)

    // Calculate the start of the previous month and the start of the current month (for boundary)
    const prevMonthStartDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)); // e.g., 2025-05-01 00:00:00 UTC
    const currentMonthStartDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));   // e.g., 2025-06-01 00:00:00 UTC

    console.log(`Processing invoices for period (UTC): ${prevMonthStartDate.toISOString()} to ${currentMonthStartDate.toISOString()}`);

    // --- 2. Fetch pricing per event ---
    const { data: pricingTier, error: pricingError } = await supabaseClient
        .from('pricing_tiers')
        .select('price_per_event, currency')
        .eq('name', 'Pay-as-you-go') // Ensure this matches your pricing tier name
        .single();

    if (pricingError || !pricingTier) {
        console.error('Failed to fetch pricing tier:', pricingError);
        return new Response(JSON.stringify({ error: 'Pricing tier not found or database error.' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
        });
    }
    const pricePerEventCents = Math.round(pricingTier.price_per_event * 100); // Convert to cents, ensure integer for Stripe
    const currency = pricingTier.currency.toLowerCase(); // Stripe usually prefers lowercase currency codes


    // --- 3. Fetch relevant shops ---
    // Select shops that have a Stripe customer ID and a default payment method,
    // and are either 'active' or 'past_due' (as 'trial' shops won't be billed monthly yet)
    const { data: shops, error: shopsError } = await supabaseClient
      .from('shops')
      .select('id, name, email, stripe_customer_id, stripe_payment_method_id, account_balance, subscription_status')
      .not('stripe_customer_id', 'is', null)
      .not('stripe_payment_method_id', 'is', null)
      .in('subscription_status', ['active', 'past_due']);

    if (shopsError) {
      console.error('Error fetching eligible shops:', shopsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch shops for billing.' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const billingResults = [];

    // --- 4. Process each shop ---
    for (const shop of shops) {
      console.log(`Processing shop: ${shop.name} (${shop.id}), current status: ${shop.subscription_status}`);

      let currentShopBalance = shop.account_balance || 0;

      // --- 4.1 Count billable events for the previous month that haven't been billed yet ---
      const { data: billableEvents, error: eventsError } = await supabaseClient
        .from('billable_events')
        .select('id')
        .eq('shop_id', shop.id)
        .eq('is_billable', true) // <-- CRITICAL: Only count events explicitly marked as billable
        .is('invoice_id', null) // <-- CRITICAL: Only count events NOT YET LINKED TO AN INVOICE
        .gte('created_at', prevMonthStartDate.toISOString())
        .lt('created_at', currentMonthStartDate.toISOString());

      if (eventsError) {
        console.error(`Error fetching billable events for shop ${shop.id}:`, eventsError);
        billingResults.push({ shop_id: shop.id, status: 'error', message: `Failed to fetch events: ${eventsError.message}` });
        continue; // Move to next shop
      }

      const eventCount = billableEvents.length;
      const amountForCurrentPeriod = eventCount * pricePerEventCents;
      const totalAmountDue = amountForCurrentPeriod + currentShopBalance; // Sum current events and outstanding balance

      if (totalAmountDue <= 0) {
          console.log(`Shop ${shop.id}: No new amount due for events (${eventCount}) and no outstanding balance (${currentShopBalance}). Skipping invoice creation.`);
          billingResults.push({ shop_id: shop.id, status: 'skipped', message: 'No amount due or balance to clear.' });
          continue; // Move to next shop
      }
      
      let newInvoiceId: string | null = null;
      let stripeInvoiceResponse: Stripe.Invoice | null = null;
      let finalInvoiceStatus = 'failed'; // Default to failed
      let stripeChargeId: string | null = null;

      try {
        // --- 4.2 Create Stripe Invoice (Draft) ---
        // Stripe Invoices are more robust for recurring billing than direct charges.
        stripeInvoiceResponse = await stripe.invoices.create({
          customer: shop.stripe_customer_id!,
          collection_method: 'charge_automatically',
          auto_advance: true, // Automatically finalizes and attempts to charge
          currency: currency,
          description: `Monthly usage for ${new Date(prevMonthStartDate).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
          metadata: { // IMPORTANT: Add metadata to link back to your shop
              shop_id: shop.id,
          }
          // default_payment_method is inherited from customer's invoice_settings
        });

        // --- 4.3 Add Line Items ---
        if (amountForCurrentPeriod > 0) {
            await stripe.invoiceItems.create({
                customer: shop.stripe_customer_id!,
                invoice: stripeInvoiceResponse.id,
                amount: amountForCurrentPeriod,
                currency: currency,
                description: `Usage (${eventCount} clients) @ $${(pricePerEventCents / 100).toFixed(2)} per client`,
            });
        }
        
        if (currentShopBalance > 0) {
            await stripe.invoiceItems.create({
                customer: shop.stripe_customer_id!,
                invoice: stripeInvoiceResponse.id,
                amount: currentShopBalance,
                currency: currency,
                description: 'Outstanding balance from previous period(s)',
            });
        }

        // --- 4.4 Finalize and Attempt to Pay Invoice ---
        // This will attempt to collect payment using the customer's default payment method.
        // Stripe's automatic collection will retry failed payments based on your Stripe Dashboard settings.
        stripeInvoiceResponse = await stripe.invoices.pay(stripeInvoiceResponse.id);

        if (stripeInvoiceResponse.status === 'paid') {
          finalInvoiceStatus = 'paid';
          stripeChargeId = stripeInvoiceResponse.charge ? (stripeInvoiceResponse.charge as Stripe.Charge).id : null;
          console.log(`Invoice ${stripeInvoiceResponse.id} for shop ${shop.id} successfully paid.`);
          billingResults.push({ shop_id: shop.id, status: 'paid', stripe_invoice_id: stripeInvoiceResponse.id });
        } else {
          // If status is 'open', 'draft' (after auto_advance fails), or other non-paid
          finalInvoiceStatus = 'failed';
          console.warn(`Invoice ${stripeInvoiceResponse.id} for shop ${shop.id} payment failed or is pending. Status: ${stripeInvoiceResponse.status}`);
          billingResults.push({ shop_id: shop.id, status: 'failed', stripe_invoice_id: stripeInvoiceResponse.id });
        }

      } catch (stripeError: any) {
        finalInvoiceStatus = 'failed';
        console.error(`Stripe API error for shop ${shop.id}:`, stripeError.message);
        billingResults.push({ shop_id: shop.id, status: 'stripe_api_error', message: stripeError.message });
      }

      // --- 4.5 Record Invoice in Supabase `invoices` table ---
      // This is a direct record of the *attempt*, the actual status might change via webhook
      const { data: insertedInvoice, error: insertInvoiceError } = await supabaseClient
        .from('invoices')
        .insert({
          shop_id: shop.id,
          month: prevMonthStartDate.toISOString().split('T')[0], // Store as YYYY-MM-DD
          amount_due: totalAmountDue,
          amount_paid: finalInvoiceStatus === 'paid' ? totalAmountDue : 0, // Initial assumption based on direct call
          currency: currency,
          status: finalInvoiceStatus, // Initial assumption based on direct call
          stripe_invoice_id: stripeInvoiceResponse?.id || null,
          stripe_charge_id: stripeChargeId,
          due_date: new Date(today.setUTCDate(today.getUTCDate() + 7)).toISOString(), // Due in 7 days from today's run
        })
        .select('id')
        .single();

      if (insertInvoiceError) {
        console.error(`Error inserting invoice for shop ${shop.id}:`, insertInvoiceError);
        billingResults.push({ shop_id: shop.id, status: 'error', message: `Failed to record invoice in DB: ${insertInvoiceError.message}` });
        continue;
      }
      newInvoiceId = insertedInvoice.id;


      // --- 4.6 Update `billable_events` as billed ---
      // Mark all events that were *just included* in this invoice by linking them to the invoice ID.
      if (billableEvents.length > 0 && newInvoiceId) { // Ensure there are events and an invoice was created
        const eventIdsToUpdate = billableEvents.map(event => event.id);
        const { error: updateEventsError } = await supabaseClient
          .from('billable_events')
          .update({ invoice_id: newInvoiceId }) // <-- CRITICAL: Update invoice_id to mark as billed
          .in('id', eventIdsToUpdate); // Update only the specific events counted

        if (updateEventsError) {
          console.error(`Error updating billable_events invoice_id for shop ${shop.id}:`, updateEventsError);
          billingResults.push({ shop_id: shop.id, status: 'error', message: `Failed to update billable events invoice_id: ${updateEventsError.message}` });
        }
      }
      
      // --- 4.7 REMOVE shop `subscription_status` and `account_balance` updates ---
      // These updates will now be handled by the Stripe webhook handler.
      /*
      let newShopStatus = shop.subscription_status;
      let newAccountBalance = 0; // Reset for paid, accumulate for failed

      if (finalInvoiceStatus === 'paid') {
          newShopStatus = 'active'; // Always active if payment goes through
          newAccountBalance = 0;
      } else if (finalInvoiceStatus === 'failed') {
          newShopStatus = 'past_due'; // Mark as past_due if payment failed
          newAccountBalance = totalAmountDue; // Carry over the full outstanding amount
      }

      const { error: updateShopStatusError } = await supabaseClient
          .from('shops')
          .update({
              subscription_status: newShopStatus,
              account_balance: newAccountBalance,
              updated_at: new Date().toISOString() // Update timestamp
          })
          .eq('id', shop.id);
      
      if (updateShopStatusError) {
          console.error(`Error updating shop status/balance for ${shop.id}:`, updateShopStatusError);
          billingResults.push({ shop_id: shop.id, status: 'error', message: `Failed to update shop status/balance: ${updateShopStatusError.message}` });
      }
      */
    }

    // --- 5. Return overall results ---
    return new Response(JSON.stringify({ message: 'Monthly invoicing process completed.', results: billingResults }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('An unhandled error occurred in process-monthly-invoices:', error.message, error);
    return new Response(JSON.stringify({ error: error.message || 'An unhandled server error occurred.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});