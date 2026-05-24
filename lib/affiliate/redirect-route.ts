import { NextRequest, NextResponse } from "next/server";

import { canTrackWishlistAffiliateRedirect } from "@/lib/affiliate/redirect-access";
import { recordServerFailure } from "@/lib/security/audit";
import { resolveTrustedAppOrigin } from "@/lib/security/app-origin";
import { enforceRateLimit } from "@/lib/security/rate-limit";
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

async function enforceAffiliateRedirectRateLimit(options: {
  action: string;
  rateLimitSubjectPrefix: string;
  userId: string;
  wishlistItemId: string;
}): Promise<NextResponse | null> {
  const rateLimit = await enforceRateLimit({
    action: options.action,
    actorUserId: options.userId,
    maxAttempts: 100,
    resourceId: options.wishlistItemId,
    resourceType: "affiliate_redirect",
    subject: `${options.rateLimitSubjectPrefix}:${options.userId}`,
    windowSeconds: 3600,
  });

  if (rateLimit.allowed) {
    return null;
  }

  return new NextResponse(rateLimit.message, {
    status: 429,
    headers: {
      "Cache-Control": "no-store",
      "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)),
    },
  });
}

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
  const trustedOrigin = resolveTrustedAppOrigin(new URL(request.url));

  if (!user) {
    return {
      allowed: false,
      response: NextResponse.redirect(new URL("/login", trustedOrigin)),
    };
  }

  const rateLimitResponse = await enforceAffiliateRedirectRateLimit({
    action: rateLimitAction,
    rateLimitSubjectPrefix,
    userId: user.id,
    wishlistItemId,
  });

  if (rateLimitResponse) {
    return {
      allowed: false,
      response: rateLimitResponse,
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
      response: NextResponse.redirect(new URL("/secret-santa", trustedOrigin)),
    };
  }

  return { allowed: true, userId: user.id };
}
