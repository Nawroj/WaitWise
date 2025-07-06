import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Make the function ASYNC
export async function createClient() {
  // AWAIT the cookies() function
  const cookieStore = await cookies();

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
              error,
            );
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            console.error(
              "Error removing cookie in Supabase server client:",
              error,
            );
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    },
  );
}
export function createServiceRoleClient(): SupabaseClient {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing environment variable NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing environment variable SUPABASE_SERVICE_ROLE_KEY');
  }

  // Provide a dummy cookies object.
  // The service_role_key client doesn't actually use these for session management,
  // but createServerClient requires them.
  const dummyCookieStore = {
    get: (name: string) => undefined, // Always return undefined for get
    set: (name: string, value: string, options: CookieOptions) => {}, // Do nothing for set
    remove: (name: string, options: CookieOptions) => {}, // Do nothing for remove
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: dummyCookieStore, // Pass the dummy cookies object
    }
  );
}