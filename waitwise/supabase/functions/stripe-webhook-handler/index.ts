// supabase/functions/stripe-webhook-handler/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'
import Stripe from 'https://esm.sh/stripe@14.24.0?target=deno' // Using stripe@14.24.0 as previously discussed

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string // IMPORTANT: Ensure service role key is used
)

// Initialize Stripe client
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Get your webhook secret from Supabase secrets
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') as string;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    console.warn(`Webhook received non-POST request: ${req.method}`);
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const rawBody = await req.text(); // Read raw body for webhook verification
  const sig = req.headers.get('stripe-signature');

  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    console.error('Missing Stripe-Signature header or STRIPE_WEBHOOK_SECRET environment variable.');
    return new Response(JSON.stringify({ error: 'Webhook Error: Missing signature or secret' }), { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), { status: 400 });
  }

  console.log(`Received Stripe event type: ${event.type} for object ID: ${event.data.object.id}`);

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        let shopId = invoice.metadata?.shop_id;
        const customerId = invoice.customer as string;

        console.log(`Processing invoice.payment_succeeded for invoice: ${invoice.id}, shopId from metadata: ${shopId}`);

        if (!shopId) {
            console.warn(`invoice.payment_succeeded: shop_id not found in invoice metadata. Attempting to lookup via customer ID: ${customerId}`);
            const { data: shops, error: findShopError } = await supabase
                .from('shops')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .single();

            if (findShopError || !shops) {
                console.error('Could not find shop by customer ID:', customerId, findShopError?.message);
                return new Response(JSON.stringify({ received: true, error: 'Shop not found for customer' }), { status: 200 }); // Still acknowledge
            }
            shopId = shops.id;
            console.log(`Found shopId ${shopId} via customer ID lookup.`);
        }

        // Update local invoice record
        const { error: invoiceUpdateError } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            amount_paid: invoice.amount_paid,
            stripe_charge_id: invoice.charge ? (invoice.charge as string) : null, // Ensure string type
          })
          .eq('stripe_invoice_id', invoice.id);

        if (invoiceUpdateError) {
          console.error('Error updating invoice to paid in DB:', invoiceUpdateError);
        } else {
            console.log(`Invoice ${invoice.id} marked as 'paid' in DB.`);
        }

        // Update shop subscription status
        const { error: shopUpdateError } = await supabase
          .from('shops')
          .update({ subscription_status: 'active', account_balance: 0 }) // Set balance to 0 on success
          .eq('id', shopId);

        if (shopUpdateError) {
          console.error('Error updating shop status to active/balance in DB:', shopUpdateError);
        } else {
            console.log(`Shop ${shopId} status set to 'active' and balance reset.`);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        let shopId = invoice.metadata?.shop_id;
        const customerId = invoice.customer as string;
        const failedReason = invoice.last_finalization_error?.message || invoice.last_payment_error?.message || 'Payment failed.';


        console.log(`Processing invoice.payment_failed for invoice: ${invoice.id}, shopId from metadata: ${shopId}, Reason: ${failedReason}`);

        if (!shopId) {
            console.warn(`invoice.payment_failed: shop_id not found in invoice metadata. Attempting to lookup via customer ID: ${customerId}`);
            const { data: shops, error: findShopError } = await supabase
                .from('shops')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .single();

            if (findShopError || !shops) {
                console.error('Could not find shop by customer ID:', customerId, findShopError?.message);
                return new Response(JSON.stringify({ received: true, error: 'Shop not found for customer' }), { status: 200 });
            }
            shopId = shops.id;
            console.log(`Found shopId ${shopId} via customer ID lookup.`);
        }

        // Update local invoice record
        const { error: invoiceUpdateError } = await supabase
          .from('invoices')
          .update({
            status: 'failed',
            error_message: failedReason, // Store the failure reason
          })
          .eq('stripe_invoice_id', invoice.id);

        if (invoiceUpdateError) {
          console.error('Error updating invoice to failed in DB:', invoiceUpdateError);
        } else {
            console.log(`Invoice ${invoice.id} marked as 'failed' in DB.`);
        }

        // Update shop subscription status to 'past_due' and update account_balance
        const { error: shopUpdateError } = await supabase
          .from('shops')
          .update({
            subscription_status: 'past_due',
            account_balance: invoice.amount_due, // Set outstanding balance to amount due on failed invoice
          })
          .eq('id', shopId);

        if (shopUpdateError) {
          console.error('Error updating shop status to past_due/balance in DB:', shopUpdateError);
        } else {
            console.log(`Shop ${shopId} status set to 'past_due' and balance updated to ${invoice.amount_due}.`);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const newStatus = subscription.status; // 'active', 'past_due', 'canceled', etc.

        console.log(`Processing customer.subscription.updated for customer: ${customerId}, new status: ${newStatus}`);

        const { data: shopData, error: shopError } = await supabase
            .from('shops')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

        if (shopError || !shopData) {
            console.error('customer.subscription.updated: Shop not found for customer:', customerId, shopError?.message);
            return new Response(JSON.stringify({ received: true, error: 'Shop not found for customer' }), { status: 200 });
        }

        // Only update status and clear balance if the status indicates a non-debt state
        // This event might duplicate updates from invoice.payment_succeeded/failed,
        // but it's a good fallback for overall subscription status.
        let accountBalanceUpdate = {};
        if (newStatus === 'active' || newStatus === 'canceled' || newStatus === 'ended') {
            accountBalanceUpdate = { account_balance: 0 };
        }

        const { error: updateError } = await supabase
          .from('shops')
          .update({ subscription_status: newStatus, ...accountBalanceUpdate })
          .eq('id', shopData.id);

        if (updateError) {
          console.error('Error updating shop subscription status via webhook (customer.subscription.updated):', updateError);
        } else {
            console.log(`Shop ${shopData.id} subscription status set to '${newStatus}' via customer.subscription.updated webhook.`);
        }
        break;
      }
      // Add other event types as needed, e.g., 'customer.created'
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error: any) {
    console.error('Error processing Stripe webhook event:', error.message, error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
