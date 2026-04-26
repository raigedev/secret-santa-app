import { NextRequest, NextResponse } from "next/server";

import { canTrackWishlistAffiliateRedirect } from "@/lib/affiliate/redirect-access";
import { recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { extractRequestClientIp } from "@/lib/security/web";
import { createClient } from "@/lib/supabase/server";

type AffiliateRedirectAccessResult =
  | {
      allowed: true;
      userId: string;
    }
  | {
      allowed: false;
      response: NextResponse;
    };

type RequireWishlistAffiliateRedirectAccessOptions = {
  accessFailureEventType: string;
  auditDetails?: Record<string, string | null>;
  groupId: string;
  path: string;
  rateLimitAction: string;
  rateLimitSubjectPrefix: string;
  request: NextRequest;
  wishlistItemId: string;
};

export async function requireWishlistAffiliateRedirectAccess({
  accessFailureEventType,
  auditDetails,
  groupId,
  path,
  rateLimitAction,
  rateLimitSubjectPrefix,
  request,
  wishlistItemId,
}: RequireWishlistAffiliateRedirectAccessOptions): Promise<AffiliateRedirectAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      allowed: false,
      response: NextResponse.redirect(new URL("/login", request.url)),
    };
  }

  const accessCheck = await canTrackWishlistAffiliateRedirect({
    groupId,
    userId: user.id,
    wishlistItemId,
  });

  if (!accessCheck.allowed) {
    if (accessCheck.error) {
      await recordServerFailure({
        actorUserId: user.id,
        details: {
          groupId,
          path,
          reason: accessCheck.reason,
          wishlistItemId,
          ...auditDetails,
        },
        errorMessage: accessCheck.error,
        eventType: accessFailureEventType,
        resourceId: wishlistItemId,
        resourceType: "affiliate_redirect",
      });
    }

    return {
      allowed: false,
      response: NextResponse.redirect(new URL("/secret-santa", request.url)),
    };
  }

  const clientIp = extractRequestClientIp(request.headers) || "unknown";
  const rateLimit = await enforceRateLimit({
    action: rateLimitAction,
    actorUserId: user.id,
    maxAttempts: 100,
    resourceId: wishlistItemId,
    resourceType: "affiliate_redirect",
    subject: `${rateLimitSubjectPrefix}:${user.id}:${clientIp}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return {
      allowed: false,
      response: new NextResponse(rateLimit.message, {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)),
        },
      }),
    };
  }

  return { allowed: true, userId: user.id };
}
