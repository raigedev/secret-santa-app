"use client";

// This client runs in the browser.
// It stores PKCE verifier + flow state in cookies (NOT localStorage).
// This is required so the server can read the PKCE state during the callback.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}