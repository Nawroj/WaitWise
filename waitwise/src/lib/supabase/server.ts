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
        get(name: string) { // MODIFIED: Removed Prefix with _ - parameter is used
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) { // MODIFIED: Removed Prefix with _ - parameters are used
          try {
            cookieStore.set({ name, value, ...options }); // Correct usage of prefixed parameters
          } catch (error) {
            console.error(
              "Error setting cookie in Supabase server client:",
              error,
            );
          }
        },
        remove(name: string, options: CookieOptions) { // MODIFIED: Removed Prefix with _ - parameters are used
          try {
            cookieStore.set({ name, value: "", ...options }); // Correct usage of prefixed parameters
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
    get: (name: string) => undefined, // MODIFIED: Removed Prefix with _ - parameter is used
    set: (name: string, value: string, options: CookieOptions) => {}, // MODIFIED: Removed Prefix with _ - parameters are used
    remove: (name: string, options: CookieOptions) => {}, // MODIFIED: Removed Prefix with _ - parameters are used
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: dummyCookieStore,
    }
  );
}