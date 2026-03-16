// This middleware protects routes using Supabase sessions stored in cookies.
// It runs on the server and uses @supabase/ssr to read/write cookies.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create Supabase server client with cookie support
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Get session from cookies
  const { data: { session } } = await supabase.auth.getSession();

  const isAuthPage = ["/login", "/create-account", "/forgot-password"]
    .includes(req.nextUrl.pathname);

  // If logged in and visiting login pages → redirect to dashboard
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // If NOT logged in and trying to access dashboard → redirect to login
  if (!session && req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/login", "/create-account", "/forgot-password", "/dashboard/:path*"],
};