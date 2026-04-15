import { NextRequest, NextResponse } from "next/server";

import { loadLazadaHealthStatus, type LazadaHealthStatus } from "@/lib/affiliate/lazada-health";
import { getAffiliateReportAllowedEmails } from "@/lib/affiliate/report-access";
import { createNotification } from "@/lib/notifications";
import { recordServerFailure } from "@/lib/security/audit";
import { extractBearerToken, safeEqualSecret } from "@/lib/security/web";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEALTH_NOTIFICATION_TYPE = "affiliate_lazada_health";
const AUTH_USERS_PER_PAGE = 1000;
const MAX_AUTH_USER_PAGES = 10;

type AuthUserSummary = {
  email?: string | null;
  id: string;
};

function isAuthorizedRequest(request: NextRequest): boolean {
  const authorizationToken = extractBearerToken(request.headers.get("authorization"));
  const cronSecret = process.env.CRON_SECRET?.trim();
  const healthSecret = process.env.AFFILIATE_HEALTH_CHECK_SECRET?.trim();
  const headerSecret = request.headers.get("x-affiliate-health-secret")?.trim();

  if (cronSecret && safeEqualSecret(cronSecret, authorizationToken)) {
    return true;
  }

  if (healthSecret) {
    return (
      safeEqualSecret(healthSecret, headerSecret) ||
      safeEqualSecret(healthSecret, authorizationToken)
    );
  }

  if (request.headers.has("x-vercel-cron")) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    const queryToken = request.nextUrl.searchParams.get("token")?.trim();
    return healthSecret ? safeEqualSecret(healthSecret, queryToken) : true;
  }

  return false;
}

async function loadAffiliateOwnerUserIds(): Promise<string[]> {
  const allowedEmails = new Set(getAffiliateReportAllowedEmails());
  const ownerUserIds = new Set<string>();

  if (allowedEmails.size === 0) {
    return [];
  }

  for (let page = 1; page <= MAX_AUTH_USER_PAGES; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    });

    if (error) {
      throw new Error(error.message);
    }

    const users = (data.users || []) as AuthUserSummary[];

    for (const user of users) {
      const email = user.email?.trim().toLowerCase();

      if (email && allowedEmails.has(email)) {
        ownerUserIds.add(user.id);
      }
    }

    if (users.length < AUTH_USERS_PER_PAGE) {
      break;
    }
  }

  return Array.from(ownerUserIds);
}

function buildHealthNotificationCopy(health: LazadaHealthStatus): {
  body: string;
  title: string;
} {
  if (health.tokenMismatchedRecentClicks > 0) {
    return {
      body: `${health.tokenMismatchedRecentClicks} recent Lazada clicks have token mismatches. Open the report and test one fresh click.`,
      title: "Lazada click tokens need attention",
    };
  }

  if (!health.postbackSecretConfigured) {
    return {
      body: "The postback secret is missing, so Lazada sales should not be accepted yet.",
      title: "Lazada postback secret is missing",
    };
  }

  if (health.unmappedConversions > 0) {
    return {
      body: `${health.unmappedConversions} real Lazada conversion rows are not mapped to clicks yet.`,
      title: "Lazada sales need mapping",
    };
  }

  if (health.clicksLast24Hours === 0) {
    return {
      body: "No Lazada clicks were recorded in the last 24 hours. Run one live wishlist click to confirm tracking.",
      title: "No recent Lazada clicks",
    };
  }

  return {
    body: "Lazada tracking is in watch mode. Open the report for the exact signal.",
    title: "Lazada affiliate health watch",
  };
}

async function hasRecentHealthNotification(userId: string, sinceIso: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", HEALTH_NOTIFICATION_TYPE)
    .gte("created_at", sinceIso)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).length > 0;
}

async function notifyOwnersIfNeeded(health: LazadaHealthStatus, now: Date): Promise<number> {
  if (health.status === "healthy") {
    return 0;
  }

  const ownerUserIds = await loadAffiliateOwnerUserIds();
  const sinceIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const copy = buildHealthNotificationCopy(health);
  let created = 0;

  for (const userId of ownerUserIds) {
    if (await hasRecentHealthNotification(userId, sinceIso)) {
      continue;
    }

    const notificationId = await createNotification({
      body: copy.body,
      linkPath: "/dashboard/affiliate-report",
      metadata: {
        checkedAt: health.checkedAt,
        clicksLast24Hours: health.clicksLast24Hours,
        status: health.status,
        tokenMismatchedRecentClicks: health.tokenMismatchedRecentClicks,
        unmappedConversions: health.unmappedConversions,
      },
      title: copy.title,
      type: HEALTH_NOTIFICATION_TYPE,
      userId,
    });

    if (notificationId) {
      created += 1;
    }
  }

  return created;
}

async function handleRequest(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    const health = await loadLazadaHealthStatus(now);
    const notificationsCreated = await notifyOwnersIfNeeded(health, now);

    return NextResponse.json(
      {
        checkedAt: now.toISOString(),
        health,
        notificationsCreated,
        ok: true,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Lazada health check error.";

    await recordServerFailure({
      details: {
        path: "/api/affiliate/lazada/health-check",
      },
      errorMessage: message,
      eventType: "affiliate.lazada.health_check",
      resourceType: "affiliate_health",
    });

    return NextResponse.json(
      {
        error: message,
        ok: false,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
