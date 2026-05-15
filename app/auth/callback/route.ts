import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendWelcomeEmail } from "@/lib/email/welcome-email";
import { createNotification } from "@/lib/notifications";
import { recordServerFailure } from "@/lib/security/audit";
import {
  createOAuthCallbackErrorLoginUrl,
  getOAuthCallbackErrorDetails,
  hasOAuthCallbackError,
} from "@/lib/auth/oauth-callback-errors";
import { ELIGIBLE_EMAIL_INVITE_STATUSES } from "@/lib/groups/invite-claim.mjs";
import { normalizeSafeAppPath, resolveTrustedAppOrigin } from "@/lib/security/web";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WELCOME_NOTIFICATION_TYPE = "welcome";
const WELCOME_NOTIFICATION_ID_NAMESPACE = "secret-santa:welcome-notification";
const WELCOME_EMAIL_RECEIPTS_TABLE = "welcome_email_receipts";

type WelcomeNotificationState = {
  id: string;
};

type WelcomeEmailReceiptState = "missing" | "present" | "unknown";

function buildWelcomeNotificationId(userId: string): string {
  const hex = createHash("sha256")
    .update(`${WELCOME_NOTIFICATION_ID_NAMESPACE}:${userId}`)
    .digest("hex");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  // A stable primary key lets callback retries race without duplicate notification rows.
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function getWelcomeEmailDisplayName(user: User): string | null {
  const metadataName = user.user_metadata?.name || user.user_metadata?.full_name;
  return typeof metadataName === "string" ? metadataName : null;
}

async function loadWelcomeNotification(
  userId: string,
  notificationId: string
): Promise<WelcomeNotificationState | null> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("id", notificationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "auth.callback.load_welcome_notification",
      resourceId: userId,
      resourceType: "notification",
    });

    return null;
  }

  if (!data?.id) {
    return null;
  }

  return {
    id: data.id as string,
  };
}

async function ensureWelcomeNotification(userId: string): Promise<WelcomeNotificationState | null> {
  const welcomeNotificationId = buildWelcomeNotificationId(userId);

  await createNotification({
    body: "Your account is ready. Create a group, add wishlist ideas, or open any invites waiting on your dashboard.",
    id: welcomeNotificationId,
    ignoreDuplicate: true,
    linkPath: "/dashboard",
    metadata: {
      source: "auth_callback",
    },
    title: "Welcome to My Secret Santa",
    type: WELCOME_NOTIFICATION_TYPE,
    userId,
  });

  const loadedNotification = await loadWelcomeNotification(userId, welcomeNotificationId);

  if (loadedNotification) {
    return loadedNotification;
  }

  await recordServerFailure({
    actorUserId: userId,
    errorMessage: "Welcome notification was not created or found",
    eventType: "auth.callback.welcome_notification_missing",
    resourceId: userId,
    resourceType: "notification",
  });

  return null;
}

async function getWelcomeEmailReceiptState(userId: string): Promise<WelcomeEmailReceiptState> {
  const { data, error } = await supabaseAdmin
    .from(WELCOME_EMAIL_RECEIPTS_TABLE)
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "email.welcome.receipt_lookup",
      resourceId: userId,
      resourceType: "email",
    });

    return "unknown";
  }

  return data?.user_id ? "present" : "missing";
}

async function recordWelcomeEmailReceipt(input: {
  email: string;
  notificationId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from(WELCOME_EMAIL_RECEIPTS_TABLE).insert({
    email: input.email.trim().toLowerCase(),
    notification_id: input.notificationId,
    user_id: input.userId,
  });

  if (error && error.code !== "23505") {
    await recordServerFailure({
      actorUserId: input.userId,
      errorMessage: error.message,
      eventType: "email.welcome.receipt_record",
      resourceId: input.userId,
      resourceType: "email",
    });
  }
}

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

  if (!code && hasOAuthCallbackError(requestUrl.searchParams)) {
    await recordServerFailure({
      errorMessage:
        getOAuthCallbackErrorDetails(requestUrl.searchParams) ||
        "OAuth callback returned an error without a code",
      eventType: "auth.callback.oauth_error",
      resourceType: "auth_callback",
    });

    return NextResponse.redirect(createOAuthCallbackErrorLoginUrl(origin));
  }

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

  const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await recordServerFailure({
      errorMessage: error.message,
      eventType: "auth.callback.exchange_failed",
      resourceType: "auth_callback",
    });

    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  const user = authData.user;

  if (!user?.id) {
    await recordServerFailure({
      errorMessage: "OAuth code exchange completed without a user",
      eventType: "auth.callback.missing_user",
      resourceType: "auth_callback",
    });

    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  if (!user.email) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: "OAuth user did not include an email address",
      eventType: "auth.callback.missing_user_email",
      resourceId: user.id,
      resourceType: "auth_callback",
    });

    return NextResponse.redirect(new URL("/login?error=missing_email", origin));
  }

  // Preserve the old behavior that links a freshly authenticated account to
  // any email-based pending invites that already existed for that address.
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

  const welcomeNotification = await ensureWelcomeNotification(user.id);
  const welcomeEmailReceiptState = await getWelcomeEmailReceiptState(user.id);

  // The sent marker lives in a server-only table because notification rows are
  // user-visible and may be affected by future notification-center behavior.
  if (welcomeNotification && welcomeEmailReceiptState === "missing") {
    const welcomeEmailResult = await sendWelcomeEmail({
      dashboardUrl: new URL("/dashboard", origin).toString(),
      displayName: getWelcomeEmailDisplayName(user),
      email: user.email,
      userId: user.id,
    });

    if (welcomeEmailResult === "sent") {
      await recordWelcomeEmailReceipt({
        email: user.email,
        notificationId: welcomeNotification.id,
        userId: user.id,
      });
    }
  }

  return redirectResponse;
}
