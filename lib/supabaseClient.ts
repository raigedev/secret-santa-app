import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ Use SSR-aware browser client so PKCE verifier is stored in cookies
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);