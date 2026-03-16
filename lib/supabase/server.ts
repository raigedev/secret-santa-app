// This client runs on the server (middleware, route handlers, server components).
// It reads/writes cookies using Next.js's cookie store.
// This allows Supabase to complete the PKCE flow on the server.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
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