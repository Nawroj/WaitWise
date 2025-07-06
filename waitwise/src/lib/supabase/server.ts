// src/lib/supabase/server.ts

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type SupabaseClient } from '@supabase/supabase-js'; // NEW: Import SupabaseClient type
import { cookies } from "next/headers";

// Client for authenticated users in Server Components/Actions (uses cookies)
export async function createClient(): Promise<SupabaseClient> { // Added Promise<SupabaseClient> return type
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(_name: string) { // MODIFIED: Prefix with _
          return cookieStore.get(_name)?.value;
        },
        set(_name: string, _value: string, _options: CookieOptions) { // MODIFIED: Prefix with _
          try {
            cookieStore.set({ name: _name, value: _value, ..._options }); // Correct usage of prefixed parameters
          } catch (error) {
            console.error(
              "Error setting cookie in Supabase server client:",
              error,
            );
          }
        },
        remove(_name: string, _options: CookieOptions) { // MODIFIED: Prefix with _
          try {
            cookieStore.set({ name: _name, value: "", ..._options }); // Correct usage of prefixed parameters
          } catch (error) {
            console.error(
              "Error removing cookie in Supabase server client:",
              error,
            );
          }
        },
      },
    },
  );
}

// Client for API Routes/Server-side operations needing elevated privileges (uses service_role key)
export function createServiceRoleClient(): SupabaseClient { // ADDED: SupabaseClient return type
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing environment variable NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing environment variable SUPABASE_SERVICE_ROLE_KEY');
  }

  const dummyCookieStore = {
    get: (_name: string) => undefined, // MODIFIED: Prefix with _
    set: (_name: string, _value: string, _options: CookieOptions) => {}, // MODIFIED: Prefix with _
    remove: (_name: string, _options: CookieOptions) => {}, // MODIFIED: Prefix with _
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: dummyCookieStore,
    }
  );
}