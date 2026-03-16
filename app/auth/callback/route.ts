import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { CookieOptions } from "@supabase/ssr";

export async function GET(request: Request) {
  // Prepare a response object we can mutate
  const response = NextResponse.redirect(new URL("/dashboard", request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // ✅ Use NextResponse’s cookie API instead of manual parsing
          return request.headers.get("cookie")
            ?.split(";")
            .map((c) => c.trim().split("="))
            .find(([k]) => k === name)?.[1];
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set(name, "", options);
        },
      },
    }
  );

  // Exchange the code for a session
  const { data, error } = await supabase.auth.exchangeCodeForSession(request.url);
  console.log("Callback session:", data.session, "Error:", error);

  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}