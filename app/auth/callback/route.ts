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
const WELCOME_EMAIL_SENT_METADATA_KEY = "welcomeEmailSentAt";

type WelcomeNotificationState = {
  emailSentAt: string | null;
  id: string;
  metadata: Record<string, unknown>;
};

function buildWelcomeNotificationId(userId: string): string {
  const hex = createHash("sha256")
    .update(`${WELCOME_NOTIFICATION_ID_NAMESPACE}:${userId}`)
    .digest("hex");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  // A stable primary key lets callback retries race safely without a new table constraint.
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function getWelcomeEmailDisplayName(user: User): string | null {
  const metadataName = user.user_metadata?.name || user.user_metadata?.full_name;
  return typeof metadataName === "string" ? metadataName : null;
}

function normalizeWelcomeNotificationMetadata(
  value: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!value || Array.isArray(value)) {
    return {};
  }

  return value;
}

function getWelcomeEmailSentAt(metadata: Record<string, unknown>): string | null {
  const sentAt = metadata[WELCOME_EMAIL_SENT_METADATA_KEY];
  return typeof sentAt === "string" && sentAt.trim() ? sentAt : null;
}

async function loadWelcomeNotification(
  userId: string,
  notificationId: string
): Promise<WelcomeNotificationState | null> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, metadata")
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

  const metadata = normalizeWelcomeNotificationMetadata(
    data.metadata as Record<string, unknown> | null | undefined
  );

  return {
    emailSentAt: getWelcomeEmailSentAt(metadata),
    id: data.id as string,
    metadata,
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

async function markWelcomeEmailSent(
  userId: string,
  notification: WelcomeNotificationState
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({
      metadata: {
        ...notification.metadata,
        [WELCOME_EMAIL_SENT_METADATA_KEY]: new Date().toISOString(),
      },
    })
    .eq("id", notification.id)
    .eq("user_id", userId);

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "email.welcome.mark_sent",
      resourceId: userId,
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

  // Older accounts may already have the welcome notification but no record that
  // the email was sent, so the email marker must be separate from row creation.
  if (welcomeNotification && !welcomeNotification.emailSentAt) {
    const welcomeEmailResult = await sendWelcomeEmail({
      dashboardUrl: new URL("/dashboard", origin).toString(),
      displayName: getWelcomeEmailDisplayName(user),
      email: user.email,
      userId: user.id,
    });

    if (welcomeEmailResult === "sent") {
      await markWelcomeEmailSent(user.id, welcomeNotification);
    }
  }

  return redirectResponse;
}
