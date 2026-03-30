import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase admin environment variables are missing.");
}

// The admin client bypasses RLS, so it must only ever be imported by server-only code.
// Session persistence and token refresh are disabled because this client is used only for
// privileged server operations, never for end-user authentication.
export const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
