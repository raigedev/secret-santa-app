import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type AffiliateRouteRateLimitOptions = {
  action: string;
  maxAttempts: number;
  resourceId?: string;
  resourceType: string;
  rateLimitedBody?: (message: string) => Record<string, unknown>;
  retryAfterHeader?: boolean;
  windowSeconds: number;
};

export async function requireAuthenticatedAffiliateRoute(
  options: AffiliateRouteRateLimitOptions
): Promise<
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const rateLimit = await enforceRateLimit({
    action: options.action,
    actorUserId: user.id,
    maxAttempts: options.maxAttempts,
    resourceId: options.resourceId,
    resourceType: options.resourceType,
    subject: user.id,
    windowSeconds: options.windowSeconds,
  });

  if (!rateLimit.allowed) {
    const init: ResponseInit = { status: 429 };

    if (options.retryAfterHeader !== false) {
      init.headers = {
        "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)),
      };
    }

    return {
      ok: false,
      response: NextResponse.json(
        options.rateLimitedBody?.(rateLimit.message) || { error: rateLimit.message },
        init
      ),
    };
  }

  return {
    ok: true,
    userId: user.id,
  };
}
