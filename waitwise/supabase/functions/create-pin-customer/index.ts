// In supabase/functions/create-pin-customer/index.ts
import { corsHeaders } from '../_shared/cors.ts'

// --- FIX: The API URL is now determined by an environment variable ---
// This allows you to switch between the test and live Pin Payments APIs.
const PIN_API_URL = Deno.env.get('PIN_API_ENVIRONMENT') === 'live'
  ? 'https://api.pinpayments.com/1/customers'
  : 'https://test-api.pinpayments.com/1/customers';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { card_token, email } = await req.json()

    // --- NEW: Add logging for debugging ---
    console.log('Received request with email:', email, 'and card_token:', card_token ? 'Exists' : 'Missing');

    if (!card_token || !email) {
      throw new Error('Card token and email are required.')
    }

    const secretKey = Deno.env.get('PIN_SECRET_KEY')
    if (!secretKey) throw new Error('Pin Payments secret key not set.')

    const authHeader = `Basic ${btoa(secretKey + ':')}`

    const response = await fetch(PIN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, card_token }),
    })

    const responseData = await response.json()

    if (!response.ok) {
      throw new Error(responseData.error_description || 'Failed to create customer.')
    }
    
    const customerToken = responseData.response.token

    return new Response(JSON.stringify({ success: true, customer_token: customerToken }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Error in create-pin-customer:", error.message); // <-- Add server-side logging
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})