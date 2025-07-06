// src/lib/supabase/server.ts

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Client for authenticated users in Server Components/Actions (uses cookies)
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            console.error(
              "Error setting cookie in Supabase server client:",
              error
            );
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            console.error(
              "Error removing cookie in Supabase server client:",
              error
            );
          }
        },
      },
    }
  );
}

// Client for API Routes/Server-side operations needing elevated privileges (uses service_role key)
export function createServiceRoleClient(): SupabaseClient {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing environment variable NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY");
  }

  const dummyCookieStore = {
    get: () => undefined,
    set: () => {},
    remove: () => {},
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: dummyCookieStore,
    }
  );
}
