import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'; // Ensure this matches your Supabase client version
import Stripe from 'npm:stripe@18.2.1'; // Ensure this matches the Stripe version you installed

console.log('Hello from create-stripe-customer-and-attach-payment-method!');

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-05-28.basil', // Use a recent stable API version
});

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific origins like 'http://localhost:3000' in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // Crucial: allow x-client-info
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS for preflight
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { payment_method_id, email, shop_id } = await req.json();

    if (!payment_method_id || !email || !shop_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: payment_method_id, email, shop_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Merge CORS headers with Content-Type
        status: 400,
      });
    }

    // Initialize Supabase client for the Edge Function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Fetch shop details
    const { data: shop, error: shopError } = await supabaseClient
      .from('shops')
      .select('id, stripe_customer_id')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop) {
      console.error('Shop not found or error fetching shop:', shopError);
      return new Response(JSON.stringify({ error: 'Shop not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    let customerId = shop.stripe_customer_id;
    let attachedPaymentMethodId = payment_method_id; // Assume this will be the ID to store

    if (customerId) {
      // Customer already exists in Stripe, attach new payment method
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: customerId,
      });
      // Set as default payment method for future invoices
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: payment_method_id,
        },
      });
      console.log(`Attached new payment method ${payment_method_id} to existing customer ${customerId}`);

    } else {
      // Create new Stripe customer and attach payment method
      const customer = await stripe.customers.create({
        email: email,
        payment_method: payment_method_id,
        invoice_settings: {
          default_payment_method: payment_method_id,
        },
      });
      customerId = customer.id;
      console.log(`Created new Stripe customer ${customerId} and attached payment method.`);
    }

    // Update Supabase shop record
    const { error: updateError } = await supabaseClient
      .from('shops')
      .update({
        stripe_customer_id: customerId,
        stripe_payment_method_id: attachedPaymentMethodId,
        subscription_status: 'active', // Set to active on successful payment method setup
        account_balance: 0 // Reset balance, assuming new payment method covers old debts
      })
      .eq('id', shop_id);

    if (updateError) {
      console.error('Error updating shop in Supabase:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update shop record.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({
      message: 'Payment method attached successfully and shop updated.',
      customer_id: customerId,
      payment_method_id: attachedPaymentMethodId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Merge CORS headers with Content-Type
      status: 200,
    });

  } catch (error) {
    console.error('Stripe function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});