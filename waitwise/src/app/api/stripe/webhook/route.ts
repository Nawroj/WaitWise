// app/api/stripe/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '../../../../lib/supabase/server'; // Adjust path to your server-side Supabase client

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil', // Use a recent stable API version
});

// Important: Next.js API Routes (App Router) need bodyParser: false for webhooks
// to allow us to read the raw body for Stripe signature verification.
export const dynamic = 'force-dynamic'; // Ensures this route is not statically optimized

export async function POST(req: NextRequest) {
  let event: Stripe.Event;

  // 1. Get the raw body and Stripe signature
  const buf = await req.text(); // Read the raw body as text
  const sig = req.headers.get('stripe-signature'); // Get the Stripe signature from headers

  // Ensure webhook secret is set
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Stripe webhook secret is not set in environment variables.');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  try {
    // 2. Verify the webhook signature
    event = stripe.webhooks.constructEvent(buf, sig!, webhookSecret);
  } catch (err: unknown) { // Catch as unknown and then assert type or check
    let errorMessage = 'Unknown error verifying webhook signature.';
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    console.error(`❌ Error verifying Stripe webhook signature: ${errorMessage}`);
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  const supabase = createClient(); // Server-side Supabase client instance

  // 3. Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        const orderDbId = session.metadata?.order_db_id; // Retrieve your order ID from metadata

        // Crucial checks:
        // - Ensure payment_status is 'paid' (or complete, depending on session setup)
        // - Ensure amount_total matches what you expect
        // - Ensure a payment_intent exists if needed for further processing
        if (session.payment_status === 'paid' && orderDbId) {
          console.log(`✅ Checkout Session Completed: ${session.id} for Order DB ID: ${orderDbId}`);

          // Update your order in Supabase
          const { error: updateError } = await supabase // Renamed 'data' to '_data' or removed if truly unused
            .from('orders')
            .update({
              status: 'preparing', // Transition to 'preparing' upon successful payment
              is_paid: true,
              stripe_checkout_session_id: session.id, // Store session ID for future reference
              // You might store other details like payment_intent.id or customer_id
              // stripe_payment_intent_id: session.payment_intent as string,
            })
            .eq('id', orderDbId)
            .select()
            .single();

          if (updateError) {
            console.error(`🚨 Error updating order ${orderDbId} in DB after payment:`, updateError);
            // Consider logging this error to a monitoring system
            return NextResponse.json({ received: true, error: 'Database update failed' }, { status: 500 });
          }

          console.log(`Order ${orderDbId} status updated to 'preparing' and 'is_paid' true.`);
        } else {
          console.warn(`⚠️ Checkout Session Completed but not paid or missing order ID: ${session.id}`);
        }
        break;

      // Handle other relevant Stripe events if your platform needs more sophisticated logic:
      // case 'payment_intent.succeeded': // If you're creating PaymentIntents directly
      // case 'invoice.payment_failed': // For subscriptions or failed recurring payments
      // case 'charge.refunded': // To update order status to 'refunded' in your DB
      // case 'customer.subscription.deleted': // For subscription management
      // case 'account.updated': // For Stripe Connect account onboarding/status changes (like KYC complete)
      //   console.log(`Received ${event.type} event.`);
      //   // Implement logic for other event types as needed
      //   break;

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // 4. Return a 200 OK response to Stripe
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: unknown) { // Catch as unknown and then assert type or check
    let errorMessage = 'Unknown error processing event.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error(`❌ Error processing Stripe event ${event.type}:`, errorMessage);
    return NextResponse.json({ error: 'Failed to process event' }, { status: 500 });
  }
}