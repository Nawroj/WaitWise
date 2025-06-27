// In supabase/functions/create-charge/index.ts
import { corsHeaders } from '../_shared/cors.ts'

const PIN_API_HOST = Deno.env.get('PIN_API_ENVIRONMENT') === 'live'
  ? 'https://api.pinpayments.com'
  : 'https://test-api.pinpayments.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // FIX: Added 'email' to the expected parameters
    const { customer_token, amount, shop_id, email } = await req.json();

    // FIX: Updated validation to require email
    if (!customer_token || !amount || !shop_id || !email) {
      throw new Error('Customer token, amount, shop_id, and email are required.');
    }

    const secretKey = Deno.env.get('PIN_SECRET_KEY');
    if (!secretKey) throw new Error('Pin Payments secret key not set.');

    const authHeader = `Basic ${btoa(secretKey + ':')}`;
    
    const chargePayload = {
      // FIX: Added email to the charge payload
      email: email,
      description: `Monthly usage charge for shop ${shop_id}`,
      amount: amount,
      currency: 'AUD',
      customer_token: customer_token,
      metadata: {
        shop_id: shop_id,
      }
    };

    const response = await fetch(`${PIN_API_HOST}/1/charges`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chargePayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Charge failed for', customer_token, responseData.error_description);
      return new Response(JSON.stringify({ 
        success: false, 
        charge_token: null,
        error: responseData.error_description || 'An unknown payment error occurred.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      charge_token: responseData.response.token,
      error: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error in create-charge:", error.message);
    return new Response(JSON.stringify({ success: false, charge_token: null, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})