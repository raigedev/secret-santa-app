import "server-only";

import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RateLimitOptions = {
  action: string;
  actorUserId?: string | null;
  maxAttempts: number;
  resourceId?: string | null;
  resourceType: string;
  subject: string;
  windowSeconds: number;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  message: string;
  remaining: number;
  retryAfterSeconds: number;
};

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const fallbackResult: RateLimitResult = {
    allowed: false,
    message: "Too many requests. Please try again later.",
    remaining: 0,
    retryAfterSeconds: 60,
  };

  const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
    p_action: options.action,
    p_max_attempts: options.maxAttempts,
    p_subject: options.subject,
    p_window_seconds: options.windowSeconds,
  });

  if (error) {
    await recordServerFailure({
      actorUserId: options.actorUserId,
      errorMessage: error.message,
      eventType: `${options.action}.rate_limit_error`,
      resourceId: options.resourceId,
      resourceType: options.resourceType,
      details: {
        maxAttempts: options.maxAttempts,
        subject: options.subject,
        windowSeconds: options.windowSeconds,
      },
    });

    return fallbackResult;
  }

  const result = Array.isArray(data) ? (data[0] as RateLimitRow | undefined) : undefined;

  if (!result) {
    return fallbackResult;
  }

  if (!result.allowed) {
    await recordAuditEvent({
      actorUserId: options.actorUserId,
      details: {
        maxAttempts: options.maxAttempts,
        retryAfterSeconds: result.retry_after_seconds,
        subject: options.subject,
        windowSeconds: options.windowSeconds,
      },
      eventType: `${options.action}.rate_limited`,
      outcome: "rate_limited",
      resourceId: options.resourceId,
      resourceType: options.resourceType,
    });

    return {
      allowed: false,
      message: `Too many requests. Try again in ${Math.max(result.retry_after_seconds, 1)} second(s).`,
      remaining: 0,
      retryAfterSeconds: result.retry_after_seconds,
    };
  }

  return {
    allowed: true,
    message: "",
    remaining: result.remaining,
    retryAfterSeconds: 0,
  };
}
