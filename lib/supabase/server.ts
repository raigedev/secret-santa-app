// This client runs on the server (middleware, route handlers, server components).
// It reads/writes cookies using Next.js's cookie store.
// This allows Supabase to complete the PKCE flow on the server.

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Normal server client (cookie-based, anon key)
export async function createClient() {
  // ✅ cookies() is async in Next.js 16
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read all cookies
        getAll: () => cookieStore.getAll(),

        // Write all cookies returned by Supabase
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

// Admin client (service role key, no cookies)
// Use this ONLY in server actions, never in the browser
export const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);