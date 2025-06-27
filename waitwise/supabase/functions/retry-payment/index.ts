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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, amount')
      .eq('shop_id', shop_id)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (invoiceError || !invoice) throw new Error("Could not find a failed invoice to retry.");

    // FIX: Fetch the owner_id from the shop to get their email
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('pin_customer_token, owner_id')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop) throw new Error("Could not find the shop.");

    // FIX: Get the user's email from the auth schema
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(shop.owner_id);
    if (userError || !userData) throw new Error("Could not find shop owner's email.");
    const email = userData.user.email;


    const { data: chargeResponse, error: chargeError } = await supabaseAdmin.functions.invoke('create-charge', {
      body: {
        customer_token: shop.pin_customer_token,
        amount: invoice.amount,
        shop_id: shop_id,
        // FIX: Pass the email to the create-charge function
        email: email
      }
    });
    
    if (chargeError) throw new Error(`Function invocation failed: ${chargeError.message}`);
    if (!chargeResponse.success) throw new Error(chargeResponse.error || "Payment retry failed.");

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
    console.error("Error in retry-payment function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})