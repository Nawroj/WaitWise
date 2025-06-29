// supabase/functions/create-stripe-customer-and-attach-payment-method/index.ts

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
    // IMPORTANT: Use SUPABASE_SERVICE_ROLE_KEY for write operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // <-- THIS IS CRUCIAL FOR WRITE ACCESS
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Fetch shop details, including its current subscription_status
    const { data: shop, error: shopError } = await supabaseClient
      .from('shops')
      .select('id, stripe_customer_id, subscription_status') // <-- Fetch subscription_status
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
    let attachedPaymentMethodId = payment_method_id;

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
        metadata: {
          shop_id: shop_id, // IMPORTANT: Link Stripe customer to your shop for webhooks
        }
      });
      customerId = customer.id;
      console.log(`Created new Stripe customer ${customerId} and attached payment method.`);
    }

    // Prepare update object for Supabase
    const updateShopData: { 
      stripe_customer_id: string; 
      stripe_payment_method_id: string; 
      subscription_status?: string | null; 
      account_balance?: number; 
    } = {
      stripe_customer_id: customerId,
      stripe_payment_method_id: attachedPaymentMethodId,
    };

    // --- CONDITIONAL LOGIC FOR SUBSCRIPTION STATUS AND BALANCE ---
    // Only set to 'active' and reset balance if currently 'trial' or null
    if (shop.subscription_status === 'trial' || shop.subscription_status === null) {
      updateShopData.subscription_status = 'active';
      updateShopData.account_balance = 0;
      console.log(`Shop ${shop_id} status transitioning from ${shop.subscription_status || 'null'} to 'active' during card update.`);
    } else {
      console.log(`Shop ${shop_id} subscription status remains '${shop.subscription_status}' during card update (already active/past_due).`);
      // If it's 'past_due', the status will remain 'past_due'.
      // The account_balance also remains as is. The retry-payment function will handle clearing it.
    }
    // --- END CONDITIONAL LOGIC ---


    // Update Supabase shop record
    const { error: updateError } = await supabaseClient
      .from('shops')
      .update(updateShopData) // Use the conditionally built updateShopData object
      .eq('id', shop_id);

    if (updateError) {
      console.error('Error updating shop in Supabase:', updateError.message);
      return new Response(JSON.stringify({ error: `Failed to update shop record: ${updateError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({
      message: 'Payment method attached successfully and shop updated.',
      customer_id: customerId,
      payment_method_id: attachedPaymentMethodId,
      // Optionally return the updated status (which might still be past_due)
      current_shop_status: updateShopData.subscription_status || shop.subscription_status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Stripe function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
