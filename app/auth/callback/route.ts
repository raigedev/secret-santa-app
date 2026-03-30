// ─── OAuth Callback Route ───
// After Google login, Google sends the user here with a "code" in the URL.
// We exchange that code for a real session, then redirect to dashboard.
//
// THE KEY FIX: We set cookies on the REDIRECT response itself.
// Previously, cookies were set on the cookie store but the redirect
// created a new response without those cookies → session was lost.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { recordServerFailure } from "@/lib/security/audit";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  let next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? requestUrl.origin
      : `${forwardedProto}://${forwardedHost}`;

  if (!next.startsWith("/")) {
    next = "/dashboard";
  }

  // If Google didn't send a code, something went wrong
  if (!code) {
    await recordServerFailure({
      errorMessage: "No OAuth code received",
      eventType: "auth.callback.missing_code",
      resourceType: "auth_callback",
    });
    return NextResponse.redirect(
      new URL("/login?error=no_code", origin)
    );
  }

  const cookieStore = await cookies();

  // ─── Create the redirect response FIRST ───
  // This is the response that will be sent to the browser.
  // We create it now so we can attach cookies TO THIS RESPONSE.
  const redirectResponse = NextResponse.redirect(
    new URL(next, origin)
  );

  // ─── Create Supabase client that writes cookies to the redirect response ───
  // THE FIX: Instead of writing cookies to cookieStore (which gets lost),
  // we write them directly to the redirect response. This way, when the
  // browser follows the redirect, it carries the session cookies with it.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read cookies from the incoming request
        getAll: () => cookieStore.getAll(),
        // Write cookies to the REDIRECT response (not just the cookie store)
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Set on the redirect response — THIS IS THE KEY FIX
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // ─── Exchange the Google code for a Supabase session ───
  // This creates session tokens and triggers the cookie setAll above,
  // which saves them onto our redirect response.
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await recordServerFailure({
      errorMessage: error.message,
      eventType: "auth.callback.exchange_failed",
      resourceType: "auth_callback",
    });
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", origin)
    );
  }

  // ─── Link user to any groups they were invited to ───
  // If this user's email exists in group_members (from being invited),
  // fill in their user_id so they can see their groups.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email && user?.id) {
    // Update all group_members rows where:
    // - email matches this user
    // - user_id is still null (hasn't been linked yet)
    await supabase
      .from("group_members")
      .update({ user_id: user.id })
      .eq("email", user.email.toLowerCase())
      .is("user_id", null);
  }

  // ─── Return the redirect WITH the session cookies attached ───
  return redirectResponse;
}
