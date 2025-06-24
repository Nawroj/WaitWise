// In supabase/functions/retry-payment/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { shop_id } = await req.json();
    if (!shop_id) throw new Error("Shop ID is required.");

    // Create an admin client to interact with the database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Find the last failed invoice for the shop
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, amount')
      .eq('shop_id', shop_id)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Could not find a failed invoice to retry.");
    }

    // 2. Get the shop's customer token
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('pin_customer_token')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop) {
      throw new Error("Could not find the shop.");
    }

    // 3. Invoke the existing 'create-charge' function to re-attempt payment
    const { data: chargeResponse, error: chargeError } = await supabaseAdmin.functions.invoke('create-charge', {
      body: {
        customer_token: shop.pin_customer_token,
        amount: invoice.amount,
        shop_id: shop_id
      }
    });

    if (chargeError || !chargeResponse.success) {
      // If the charge fails again, update the invoice with the new error message
      await supabaseAdmin
        .from('invoices')
        .update({ error_message: chargeResponse.error || 'Retry attempt failed.' })
        .eq('id', invoice.id);

      throw new Error(chargeResponse.error || "Payment retry failed.");
    }

    // 4. If charge succeeds, update the database
    await supabaseAdmin
      .from('invoices')
      .update({ status: 'paid', charge_token: chargeResponse.charge_token, error_message: null })
      .eq('id', invoice.id);

    await supabaseAdmin
      .from('shops')
      .update({ subscription_status: 'active' })
      .eq('id', shop_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})