import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

type AuditOutcome = "failure" | "rate_limited" | "success";

type AuditEvent = {
  actorUserId?: string | null;
  details?: Record<string, unknown>;
  eventType: string;
  outcome: AuditOutcome;
  resourceId?: string | null;
  resourceType: string;
};

const REDACTED_AUDIT_VALUE = "[redacted]";
const TRUNCATED_AUDIT_VALUE = "[truncated]";
const MAX_AUDIT_DETAIL_DEPTH = 4;
const MAX_AUDIT_ARRAY_ITEMS = 50;
const MAX_AUDIT_STRING_LENGTH = 1000;

const SENSITIVE_DETAIL_KEY_PATTERN =
  /(authorization|cookie|credential|password|postback|secret|service[_-]?role|session|token|api[_-]?key)/i;

const SENSITIVE_STRING_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bsb_secret_[A-Za-z0-9._-]+/g,
  /\bsk-[A-Za-z0-9._-]+/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
] as const;

function redactSensitiveString(value: string): string {
  const redacted = SENSITIVE_STRING_PATTERNS.reduce(
    (currentValue, pattern) => currentValue.replace(pattern, REDACTED_AUDIT_VALUE),
    value
  );

  if (redacted.length <= MAX_AUDIT_STRING_LENGTH) {
    return redacted;
  }

  return `${redacted.slice(0, MAX_AUDIT_STRING_LENGTH)}...`;
}

function sanitizeDetailValue(key: string, value: unknown, depth: number): unknown {
  if (SENSITIVE_DETAIL_KEY_PATTERN.test(key)) {
    return REDACTED_AUDIT_VALUE;
  }

  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveString(value);
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_AUDIT_DETAIL_DEPTH) {
      return TRUNCATED_AUDIT_VALUE;
    }

    return value
      .slice(0, MAX_AUDIT_ARRAY_ITEMS)
      .map((item, index) => sanitizeDetailValue(`${key}[${index}]`, item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= MAX_AUDIT_DETAIL_DEPTH) {
      return TRUNCATED_AUDIT_VALUE;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeDetailValue(entryKey, entryValue, depth + 1),
      ])
    );
  }

  return String(value);
}

function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details) {
    return {};
  }

  try {
    const sanitized = sanitizeDetailValue("details", details, 0);
    return JSON.parse(JSON.stringify(sanitized)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  const { error } = await supabaseAdmin.rpc("write_audit_log", {
    p_actor_user_id: event.actorUserId ?? null,
    p_details: sanitizeDetails(event.details),
    p_event_type: event.eventType,
    p_outcome: event.outcome,
    p_resource_id: event.resourceId ?? null,
    p_resource_type: event.resourceType,
  });

  if (error) {
    // Avoid recursive logging failures. Security logging should never break app flows.
  }
}

export async function recordServerFailure(params: {
  actorUserId?: string | null;
  errorMessage: string;
  eventType: string;
  resourceId?: string | null;
  resourceType: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await recordAuditEvent({
    actorUserId: params.actorUserId,
    details: {
      ...sanitizeDetails(params.details),
      errorMessage: params.errorMessage.slice(0, 500),
    },
    eventType: params.eventType,
    outcome: "failure",
    resourceId: params.resourceId,
    resourceType: params.resourceType,
  });
}
