// In supabase/functions/update-pin-customer-card/index.ts
import { corsHeaders } from '../_shared/cors.ts'

const PIN_API_HOST = Deno.env.get('PIN_API_ENVIRONMENT') === 'live'
  ? 'https://api.pinpayments.com'
  : 'https://test-api.pinpayments.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { customer_token, card_token } = await req.json();
    if (!customer_token || !card_token) {
      throw new Error('Customer token and Card token are required.');
    }

    const secretKey = Deno.env.get('PIN_SECRET_KEY');
    if (!secretKey) throw new Error('Pin Payments secret key not set.');

    const authHeader = `Basic ${btoa(secretKey + ':')}`;

    // To update a customer, we make a PUT request to the customer's endpoint
    const response = await fetch(`${PIN_API_HOST}/1/customers/${customer_token}`, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ card_token: card_token }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error_description || 'Failed to update card.');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error in update-pin-customer-card:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})