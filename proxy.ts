import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
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
import { normalizeSafeAppPath } from "@/lib/security/safe-app-path";

const PROXY_VERIFIED_USER_CACHE_TTL_MS = 60_000;
const PROXY_VERIFIED_USER_CACHE_MAX_ENTRIES = 250;

type ProxySupabaseClient = {
  auth: {
    getSession: () => Promise<{
      data: {
        session: {
          access_token: string;
        } | null;
      };
      error: unknown;
    }>;
    getUser: () => Promise<{
      data: {
        user: User | null;
      };
      error: unknown;
    }>;
  };
};

const verifiedProxyUserCache = new Map<
  string,
  {
    expiresAt: number;
    user: User;
  }
>();

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

function getCachedVerifiedProxyUser(accessToken: string | null, now: number): User | null {
  if (!accessToken) {
    return null;
  }

  const cachedUser = verifiedProxyUserCache.get(accessToken);

  if (!cachedUser) {
    return null;
  }

  if (cachedUser.expiresAt <= now) {
    verifiedProxyUserCache.delete(accessToken);
    return null;
  }

  return cachedUser.user;
}

function cacheVerifiedProxyUser(accessToken: string | null, user: User, now: number) {
  if (!accessToken) {
    return;
  }

  if (verifiedProxyUserCache.size >= PROXY_VERIFIED_USER_CACHE_MAX_ENTRIES) {
    const oldestCacheKey = verifiedProxyUserCache.keys().next().value;

    if (oldestCacheKey) {
      verifiedProxyUserCache.delete(oldestCacheKey);
    }
  }

  verifiedProxyUserCache.set(accessToken, {
    expiresAt: now + PROXY_VERIFIED_USER_CACHE_TTL_MS,
    user,
  });
}

function getRequestAppPath(req: NextRequest): string {
  return normalizeSafeAppPath(`${req.nextUrl.pathname}${req.nextUrl.search}`, "/dashboard");
}

async function getVerifiedProxyUser(supabase: ProxySupabaseClient): Promise<User | null> {
  const now = Date.now();
  let accessToken: string | null = null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    accessToken = session?.access_token || null;
  } catch {
    accessToken = null;
  }

  const cachedUser = getCachedVerifiedProxyUser(accessToken, now);

  if (cachedUser) {
    return cachedUser;
  }

  // Keep getUser as the source of truth. getSession is used only to key the
  // short-lived cache after a user has already been verified by Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    cacheVerifiedProxyUser(accessToken, user, now);
  }

  return user || null;
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

  const user = await getVerifiedProxyUser(supabase);

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
    "/how-it-works",
    "/support",
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
    pathname === "/how-it-works" ||
    pathname === "/support" ||
    pathname === "/auth/callback" ||
    pathname === "/.well-known/security.txt" ||
    isInvitePage ||
    isLandingPage;
  const hasVerifiedEmail = user ? isUserEmailVerified(user) : false;

  if (user && !hasVerifiedEmail && !isVerificationSafePage) {
    const loginUrl = new URL("/login", trustedOrigin);
    loginUrl.searchParams.set("error", "confirm_email");
    loginUrl.searchParams.set("message", getEmailVerificationMessage());
    loginUrl.searchParams.set("next", getRequestAppPath(req));
    return NextResponse.redirect(loginUrl);
  }

  if (user && hasVerifiedEmail && isAuthPage) {
    const nextPath = normalizeSafeAppPath(req.nextUrl.searchParams.get("next"), "/dashboard");
    return NextResponse.redirect(new URL(nextPath, trustedOrigin));
  }

  if (user && hasVerifiedEmail && isLandingPage) {
    return NextResponse.redirect(new URL("/dashboard", trustedOrigin));
  }

  if (!user && !isPublicPage) {
    const loginUrl = new URL("/login", trustedOrigin);
    loginUrl.searchParams.set("next", getRequestAppPath(req));
    return NextResponse.redirect(loginUrl);
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
