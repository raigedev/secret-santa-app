import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { recordServerFailure } from "@/lib/security/audit";
import { ELIGIBLE_EMAIL_INVITE_STATUSES } from "@/lib/groups/invite-claim.mjs";
import { normalizeSafeAppPath, resolveTrustedAppOrigin } from "@/lib/security/web";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const cookieStore = await cookies();
  const nextFromCookie = cookieStore.get("post_login_next")?.value;
  const next = normalizeSafeAppPath(
    requestUrl.searchParams.get("next") ?? nextFromCookie,
    "/dashboard"
  );
  const origin = resolveTrustedAppOrigin(requestUrl);

  if (!code) {
    await recordServerFailure({
      errorMessage: "No OAuth code received",
      eventType: "auth.callback.missing_code",
      resourceType: "auth_callback",
    });

    return NextResponse.redirect(new URL("/login?error=no_code", origin));
  }

  const redirectResponse = NextResponse.redirect(new URL(next, origin));
  redirectResponse.cookies.set("post_login_next", "", {
    path: "/",
    maxAge: 0,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await recordServerFailure({
      errorMessage: error.message,
      eventType: "auth.callback.exchange_failed",
      resourceType: "auth_callback",
    });

    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  // Preserve the old behavior that links a freshly authenticated account to
  // any email-based pending invites that already existed for that address.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email && user?.id) {
    const { error: linkMembershipsError } = await supabaseAdmin
      .from("group_members")
      .update({ user_id: user.id })
      .eq("email", user.email.toLowerCase())
      .is("user_id", null)
      .in("status", ELIGIBLE_EMAIL_INVITE_STATUSES);

    if (linkMembershipsError) {
      await recordServerFailure({
        actorUserId: user.id,
        errorMessage: linkMembershipsError.message,
        eventType: "auth.callback.link_invited_memberships",
        resourceType: "group_membership",
      });
    }
  }

  return redirectResponse;
}
