// app/api/stripe/create-checkout-session/route.ts

import { NextResponse } from 'next/server'; // Import NextResponse for App Router API routes
import Stripe from 'stripe';
import { createServiceRoleClient } from '../../../../lib/supabase/server'; // Adjust path to your server-side Supabase client

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil', // Use a recent stable API version
});

// Define types for request body (optional, but good for clarity)
interface OrderItemPayload {
  menu_item_id: string;
  quantity: number;
}

// App Router API routes use named functions (e.g., POST)
export async function POST(req: Request) { // Request is standard Web Request API
  const { shop_id, items, client_name, client_phone } = await req.json(); // Parse JSON body

  const supabase = createServiceRoleClient(); // Server-side Supabase client instance

  try {
    // 1. Fetch Shop Settings and Connected Account ID
    const { data: shopSettings, error: shopSettingsError } = await supabase
      .from('shops')
      .select('enable_online_payments, pass_stripe_fees_to_customer, stripe_connect_account_id')
      .eq('id', shop_id)
      .single();

    if (shopSettingsError || !shopSettings) {
      console.error('API: Error fetching shop settings:', shopSettingsError);
      return NextResponse.json({ error: 'Shop settings not found or invalid.' }, { status: 400 });
    }

    // Ensure online payments are actually enabled for this shop
    if (!shopSettings.enable_online_payments) {
      return NextResponse.json({ error: 'Online payments are not enabled for this food truck.' }, { status: 400 });
    }
    if (!shopSettings.stripe_connect_account_id) {
        console.error('API: Shop does not have a connected Stripe account:', shop_id);
        return NextResponse.json({ error: 'Food truck is not set up to receive online payments.' }, { status: 400 });
    }

    const connectedAccountId = shopSettings.stripe_connect_account_id;

    // 2. Securely Re-calculate Total Amount & Construct Stripe Line Items
    let totalOrderValueBeforeSurchargeCents = 0; // Base price of food items
    const stripeLineItems = []; // Items to send to Stripe Checkout

    // Standard Australian Stripe card processing rates in cents
    const STRIPE_DOMESTIC_RATE = 0.0175; // 1.75%
    const STRIPE_DOMESTIC_FIXED_FEE_CENTS = 30; // A$0.30

    for (const item of items) {
      const { data: menuItem, error } = await supabase
        .from('menu_items')
        .select('price, name')
        .eq('id', item.menu_item_id)
        .eq('shop_id', shop_id) // IMPORTANT: Verify item belongs to this shop
        .single();

      if (error || !menuItem) {
        console.error('API: Error fetching menu item:', error);
        return NextResponse.json({ error: `Invalid menu item (${item.menu_item_id}) in order.` }, { status: 400 });
      }

      const itemPriceCents = Math.round(menuItem.price * 100);
      const itemTotalCents = itemPriceCents * item.quantity;
      totalOrderValueBeforeSurchargeCents += itemTotalCents;

      stripeLineItems.push({
        price_data: {
          currency: 'aud', // Australian Dollars
          product_data: {
            name: menuItem.name,
            // images: menuItem.image_url ? [menuItem.image_url] : [],
          },
          unit_amount: itemPriceCents,
        },
        quantity: item.quantity,
      });
    }

    // 3. Calculate Surcharge (if owner chose to pass fees to customer)
    let surchargeCents = 0;
    if (shopSettings.pass_stripe_fees_to_customer) {
      // Estimate the Stripe fee for the transaction for calculation.
      surchargeCents = Math.round(
        (totalOrderValueBeforeSurchargeCents * STRIPE_DOMESTIC_RATE) + STRIPE_DOMESTIC_FIXED_FEE_CENTS
      );

      const SURCHARGE_BUFFER_CENTS = 0; // Add an extra A$0.10
      surchargeCents += SURCHARGE_BUFFER_CENTS;

      // Add surcharge as a separate line item for customer transparency
      stripeLineItems.push({
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'Online Service Fee', // Customer-facing name for the surcharge
            description: 'Covers payment processing and platform convenience.',
          },
          unit_amount: surchargeCents,
        },
        quantity: 1,
      });
    }

    // The total amount the customer pays to Stripe (includes surcharge if applicable)
    const totalAmountCustomerPaysCents = totalOrderValueBeforeSurchargeCents + surchargeCents;

    // 4. Calculate Your Platform's Commission
    const PLATFORM_COMMISSION_RATE = 0; // Your platform's commission rate (7%)
    // Commission is on the base food item price, not including the surcharge.
    const platformFeeCents = Math.round(totalOrderValueBeforeSurchargeCents * PLATFORM_COMMISSION_RATE);

    // Ensure application fee is non-negative
    const finalApplicationFeeCents = Math.max(0, platformFeeCents);

    // 5. Create the Order Record in Supabase (initial state)
    const { data: newOrder, error: orderInsertError } = await supabase
      .from('orders')
      .insert({
        shop_id,
        client_name,
        client_phone: client_phone as string, // Cast to string since it's now mandatory on frontend
        total_amount: totalOrderValueBeforeSurchargeCents / 100, // Store base amount in AUD
        surcharge_amount: surchargeCents / 100, // Store surcharge in AUD
        status: 'pending', // Initial status: pending payment
        is_paid: false,
        notes: null, // Add notes if passed from frontend
      })
      .select('id') // Select the new order's ID
      .single();

    if (orderInsertError || !newOrder) {
      console.error('API: Error inserting new order into DB:', orderInsertError);
      return NextResponse.json({ error: 'Failed to create order record in database.' }, { status: 500 });
    }

    // 6. Insert individual order items into the 'order_items' table
    const orderItemsToInsert = items.map(item => ({
      order_id: newOrder.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      // You could fetch price_at_order from the menuItem object here if needed,
      // but it's okay to rely on the backend recalculation for Stripe.
      price_at_order: Math.round(items.find(i => i.menu_item_id === item.menu_item_id)?.quantity ? (totalOrderValueBeforeSurchargeCents / items.reduce((sum, item) => sum + item.quantity, 0)) : 0), // Calculate average or fetch per item
      notes: null // If individual item notes exist
    }));

    // NOTE: The `price_at_order` in orderItemsToInsert above is a simplification.
    // Ideally, you'd retrieve the actual `menuItem.price` from the DB for each `menu_item_id`
    // within this API route and use that for `price_at_order`.
    // For example:
    const detailedOrderItemsToInsert = await Promise.all(items.map(async (item) => {
        const { data: menuItem, error } = await supabase
            .from('menu_items')
            .select('price')
            .eq('id', item.menu_item_id)
            .single();
        return {
            order_id: newOrder.id,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            price_at_order: menuItem?.price || 0, // Use the actual price from DB
            notes: null
        };
    }));


    const { error: orderItemsInsertError } = await supabase
      .from('order_items')
      .insert(detailedOrderItemsToInsert); // Use detailedOrderItemsToInsert

    if (orderItemsInsertError) {
      console.error('API: Error inserting order items:', orderItemsInsertError);
      // OPTIONAL: Rollback the main order if order_items insertion fails
      await supabase.from('orders').delete().eq('id', newOrder.id);
      return NextResponse.json({ error: 'Failed to record order items in database.' }, { status: 500 });
    }


    // 7. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Supports card, Apple Pay, Google Pay
      line_items: stripeLineItems,
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/shop/${shop_id}/order-success?order_id=${newOrder.id}&session_id={CHECKOUT_SESSION_ID}`, // Use req.headers.get('origin') for dynamic origin
      cancel_url: `${req.headers.get('origin')}/shop/${shop_id}/order-cancelled?order_id=${newOrder.id}`,
      metadata: {
        // IMPORTANT: Attach metadata to link the Stripe session back to your internal order and shop
        shop_id: shop_id,
        order_db_id: newOrder.id,
        platform_fee_cents: finalApplicationFeeCents.toString(), // Your commission
        surcharge_cents: surchargeCents.toString(),             // Surcharge applied
        base_order_value_cents: totalOrderValueBeforeSurchargeCents.toString(), // Base food item total
      },
      // Stripe Connect parameters: routes funds to the connected account, taking your application fee
      payment_intent_data: {
        application_fee_amount: finalApplicationFeeCents, // Your platform's commission
        transfer_data: {
          destination: connectedAccountId, // The food truck's Stripe Connect Account ID
        },
      },
      // You can pre-fill customer email here if you have it from your order form
      // customer_email: client_email,
    });

    // 8. Update Order with Stripe Checkout Session ID
    const { error: updateOrderError } = await supabase
        .from('orders')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', newOrder.id);

    if (updateOrderError) {
        console.error('API: Error updating order with session ID:', updateOrderError);
        // This is a non-fatal error but should be logged. The webhook will ultimately confirm the payment.
    }

    // Return the sessionId to the frontend to redirect
    return NextResponse.json({ sessionId: session.id }, { status: 200 });

  } catch (error: any) {
    console.error('API: Stripe Checkout Session Creation Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout session.' }, { status: 500 });
  }
}