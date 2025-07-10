// app/api/supabase-edge-function/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { functionName, payload } = await req.json();

    if (!functionName) {
      return NextResponse.json({ error: 'functionName is required' }, { status: 400 });
    }

    // Construct the URL for your Supabase Edge Function
    // Make sure process.env.NEXT_PUBLIC_SUPABASE_URL is correctly set in your .env.local
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined in your environment variables.');
    }

    // Remove any trailing slash from the SUPABASE_URL to prevent double slashes
    const cleanSupabaseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;

    const edgeFunctionUrl = `${cleanSupabaseUrl}/functions/v1/${functionName}`;

    console.log(`[API Route] Calling Edge Function: ${functionName} at ${edgeFunctionUrl}`);
    console.log(`[API Route] Payload:`, JSON.stringify(payload));


    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // If your Edge Function requires a JWT token (i.e., not deployed with --no-verify-jwt
        // and you need RLS bypass or authenticated user context), you'd typically pass it here:
        // 'Authorization': `Bearer ${userToken}`, // User token from `await supabase.auth.getSession()`
        // For get-available-slots with --no-verify-jwt, this is usually not needed.
      },
      body: JSON.stringify(payload),
    });

    // It's good practice to log the raw response status and text if it's not OK
    if (!response.ok) {
      const errorText = await response.text(); // Get raw text to see if it's HTML
      console.error(`[API Route] Edge Function responded with ${response.status}: ${errorText}`);
      try {
        const errorData = JSON.parse(errorText); // Try parsing as JSON if it's not HTML
        return NextResponse.json({ error: errorData.error || `Edge Function error: ${functionName}` }, { status: response.status });
      } catch {
        // If it's not JSON, it's likely HTML (like a 500 error page from Supabase)
        return NextResponse.json({ error: `Edge Function returned non-JSON error: ${functionName}. Raw: ${errorText.substring(0, 200)}...` }, { status: response.status });
      }
    }

    const data = await response.json();
    console.log(`[API Route] Edge Function success: ${functionName}`, data);
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('[API Route] Top-level error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An unknown error occurred in the API route.' }, { status: 500 });
  }
}