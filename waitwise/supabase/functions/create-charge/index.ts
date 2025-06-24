import { corsHeaders } from '../_shared/cors.ts'

// Use an environment variable to switch between test and live Pin Payments API
const PIN_API_HOST = Deno.env.get('PIN_API_ENVIRONMENT') === 'live'
  ? 'https://api.pinpayments.com'
  : 'https://test-api.pinpayments.com';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // These values will be sent from our database function in the next phase
    const { customer_token, amount, shop_id } = await req.json();

    if (!customer_token || !amount || !shop_id) {
      throw new Error('Customer token, amount, and shop_id are required.');
    }

    const secretKey = Deno.env.get('PIN_SECRET_KEY');
    if (!secretKey) throw new Error('Pin Payments secret key not set.');

    const authHeader = `Basic ${btoa(secretKey + ':')}`;
    
    // Construct the payload for the Pin Payments Charge API
    const chargePayload = {
      description: `Monthly usage charge for shop ${shop_id}`,
      amount: amount, // Amount must be in cents
      currency: 'AUD',
      customer_token: customer_token,
      metadata: {
        shop_id: shop_id,
      }
    };

    // Make the request to Pin Payments
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
      // The charge failed (e.g., card declined, insufficient funds)
      console.error('Charge failed for', customer_token, responseData.error_description);
      // Return a specific error structure that our system can understand
      return new Response(JSON.stringify({ 
        success: false, 
        charge_token: null,
        error: responseData.error_description || 'An unknown payment error occurred.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // The charge was successful
    return new Response(JSON.stringify({ 
      success: true, 
      charge_token: responseData.response.token,
      error: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Critical error in create-charge function:", error.message);
    return new Response(JSON.stringify({ success: false, charge_token: null, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})