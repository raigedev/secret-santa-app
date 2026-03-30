// ─── Next.js Middleware ───
// This file runs BEFORE every page load.
// Think of it like a security guard at the front door.
// It checks: "Is this person logged in? Should they be allowed here?"
//
// IMPORTANT: This file MUST be named "middleware.ts" and MUST be
// at the project root (same folder as package.json).
// Next.js will ignore it if it's named anything else.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// The function MUST be named "middleware" — Next.js looks for this exact name.
export async function middleware(req: NextRequest) {
  // Create a response object that we can modify (add cookies to)
  const res = NextResponse.next();

  // ─── Create a Supabase client that works in middleware ───
  // Middleware can't use the normal server client because it runs
  // at the "edge" (before your page loads). So we create one manually
  // that reads/writes cookies from the request/response.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read cookies from the incoming request
        getAll: () => req.cookies.getAll(),
        // Write cookies to the outgoing response
        // This is KEY — it refreshes the auth session on every request
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // ─── Check if the user has a valid session ───
  // getUser() is more secure than getSession() because it
  // validates the token with Supabase's server, not just locally.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── Define which pages don't require login ───
  const publicPages = [
    "/",
    "/login",
    "/create-account",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",  // ← THIS WAS MISSING
  ];
  const isPublicPage = publicPages.includes(req.nextUrl.pathname);

  // ─── Define auth pages (login, signup, etc.) ───
  const authPages = ["/login", "/create-account", "/forgot-password"];
  const isAuthPage = authPages.includes(req.nextUrl.pathname);
  const isLandingPage = req.nextUrl.pathname === "/";

  // ─── Redirect logic ───

  // If the user IS logged in and tries to visit login/signup pages,
  // redirect them to the dashboard (no need to login again).
  if (user && (isAuthPage || isLandingPage)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // If the user is NOT logged in and tries to visit a protected page
  // (anything that's not public), redirect them to login.
  if (!user && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Otherwise, let them through and include the refreshed cookies.
  return res;
}

// ─── Which routes should this middleware run on? ───
// This tells Next.js: "Run the middleware function on these URL patterns."
// Without this, middleware runs on EVERY request (including images, CSS, etc.)
export const config = {
  matcher: [
    // Run on all routes EXCEPT static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
