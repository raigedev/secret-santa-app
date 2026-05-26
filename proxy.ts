import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  createOAuthCallbackErrorLoginUrl,
  hasOAuthCallbackError,
} from "@/lib/auth/oauth-callback-errors";
import { getEmailVerificationMessage, isUserEmailVerified } from "@/lib/auth/user-status";
import {
  buildContentSecurityPolicy,
  createContentSecurityPolicyNonce,
} from "@/lib/security/content-security-policy";
import { resolveTrustedAppOrigin } from "@/lib/security/app-origin";

function createGuardedPageResponse(req: NextRequest): NextResponse {
  const nonce = createContentSecurityPolicyNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy({ nonce });
  const requestHeaders = new Headers(req.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  res.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return res;
}

// Central request guard for auth, invite-link access, and email-verification redirects.
export async function proxy(req: NextRequest) {
  // Some OAuth providers bounce back to `/` with a `code` query param. Route that
  // through the callback handler first so the session is exchanged before any UI renders.
  const hasOAuthCode = req.nextUrl.searchParams.has("code");
  const isCallbackRoute = req.nextUrl.pathname === "/auth/callback";
  const trustedOrigin = resolveTrustedAppOrigin(req.nextUrl);
  const shouldForwardOAuthCode =
    hasOAuthCode &&
    !isCallbackRoute &&
    // Some OAuth providers can land on the site root. Password recovery also
    // uses a `code` query param, so only the root fallback is rewritten here.
    req.nextUrl.pathname === "/";

  if (!isCallbackRoute && hasOAuthCallbackError(req.nextUrl.searchParams)) {
    return NextResponse.redirect(createOAuthCallbackErrorLoginUrl(trustedOrigin));
  }

  if (shouldForwardOAuthCode) {
    const callbackUrl = new URL("/auth/callback", trustedOrigin);

    req.nextUrl.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.append(key, value);
    });

    if (!callbackUrl.searchParams.has("next")) {
      callbackUrl.searchParams.set("next", "/dashboard");
    }

    return NextResponse.redirect(callbackUrl);
  }

  const res = createGuardedPageResponse(req);

  // Proxy runs before the normal server helpers, so it needs its own
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
    "/cool-app",
    "/login",
    "/create-account",
    "/forgot-password",
    "/privacy",
    "/terms",
    "/affiliate-disclosure",
    "/reset-password",
    "/auth/callback",
    "/.well-known/security.txt",
  ];
  const isInvitePage = pathname.startsWith("/invite/");
  const isPublicPage = publicPages.includes(pathname) || isInvitePage;

  const authPages = ["/login", "/create-account", "/forgot-password"];
  const isAuthPage = authPages.includes(pathname);
  const isLandingPage = pathname === "/";
  const isVerificationSafePage =
    isAuthPage ||
    pathname === "/cool-app" ||
    pathname === "/reset-password" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/affiliate-disclosure" ||
    pathname === "/auth/callback" ||
    pathname === "/.well-known/security.txt" ||
    isInvitePage ||
    isLandingPage;
  const hasVerifiedEmail = user ? isUserEmailVerified(user) : false;

  if (user && !hasVerifiedEmail && !isVerificationSafePage) {
    const loginUrl = new URL("/login", trustedOrigin);
    loginUrl.searchParams.set("error", "confirm_email");
    loginUrl.searchParams.set("message", getEmailVerificationMessage());
    return NextResponse.redirect(loginUrl);
  }

  if (user && hasVerifiedEmail && (isAuthPage || isLandingPage)) {
    return NextResponse.redirect(new URL("/dashboard", trustedOrigin));
  }

  if (!user && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", trustedOrigin));
  }

  return res;
}

export const config = {
  matcher: [
    // Only run the proxy on page routes. API and redirect endpoints don't need
    // per-request auth checks here and can handle auth in their own handlers.
    "/((?!api|go|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
