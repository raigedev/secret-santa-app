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

function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(details)) as Record<string, unknown>;
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
