import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getEmailVerificationMessage, isUserEmailVerified } from "@/lib/auth/user-status";

// Central request guard for auth, invite-link access, and email-verification redirects.
export async function middleware(req: NextRequest) {
  // Some OAuth providers bounce back to `/` with a `code` query param. Route that
  // through the callback handler first so the session is exchanged before any UI renders.
  const hasOAuthCode = req.nextUrl.searchParams.has("code");
  const isCallbackRoute = req.nextUrl.pathname === "/auth/callback";

  if (hasOAuthCode && !isCallbackRoute) {
    const callbackUrl = req.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";

    if (!callbackUrl.searchParams.has("next")) {
      callbackUrl.searchParams.set("next", "/dashboard");
    }

    return NextResponse.redirect(callbackUrl);
  }

  const res = NextResponse.next();

  // Middleware runs before the normal server helpers, so it needs its own
  // cookie-aware Supabase client to read and refresh the session safely.
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

  // Validate the session with Supabase instead of trusting only local cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  const publicPages = [
    "/",
    "/login",
    "/create-account",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
  ];
  const isInvitePage = pathname.startsWith("/invite/");
  const isPublicPage = publicPages.includes(pathname) || isInvitePage;

  const authPages = ["/login", "/create-account", "/forgot-password"];
  const isAuthPage = authPages.includes(pathname);
  const isLandingPage = pathname === "/";
  const isVerificationSafePage =
    isAuthPage ||
    pathname === "/reset-password" ||
    pathname === "/auth/callback" ||
    isInvitePage ||
    isLandingPage;
  const hasVerifiedEmail = user ? isUserEmailVerified(user) : false;

  if (user && !hasVerifiedEmail && !isVerificationSafePage) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "confirm_email");
    loginUrl.searchParams.set("message", getEmailVerificationMessage());
    return NextResponse.redirect(loginUrl);
  }

  if (user && hasVerifiedEmail && (isAuthPage || isLandingPage)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (!user && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    // Only run middleware on page routes. API and redirect endpoints don't need
    // per-request auth checks here and can handle auth in their own handlers.
    "/((?!api|go|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
