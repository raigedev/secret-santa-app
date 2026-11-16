import "server-only";

import { createSmtpTransport, readSmtpConfig } from "@/lib/email/smtp";
import { recordAuditEvent } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Daily summary of security failures and rate-limit hits, emailed to the maintainer so
// problems are noticed before users report them. It sends only event names and counts,
// never user IDs, emails, error text, or payload details.
const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;
const DIGEST_RESEND_GUARD_MS = 20 * 60 * 60 * 1000;
const DIGEST_SENT_EVENT_TYPE = "security.alert_digest.sent";
const DIGEST_ROW_LIMIT = 5000;
const ALERT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SecurityAlertDigestResult =
  | "already_sent"
  | "not_configured"
  | "nothing_to_report"
  | "sent";

type DigestRow = {
  event_type: string;
  outcome: "failure" | "rate_limited";
};

function getAlertRecipient(): string | null {
  const recipient = process.env.SECURITY_ALERT_EMAIL?.trim() || "";
  return ALERT_EMAIL_PATTERN.test(recipient) ? recipient : null;
}

async function wasDigestSentRecently(now: Date): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("security_audit_logs")
    .select("id")
    .eq("event_type", DIGEST_SENT_EVENT_TYPE)
    .gte("created_at", new Date(now.getTime() - DIGEST_RESEND_GUARD_MS).toISOString())
    .limit(1);

  if (error) {
    throw new Error("Could not check the last security alert digest.");
  }

  return (data || []).length > 0;
}

async function loadDigestRows(now: Date): Promise<DigestRow[]> {
  const { data, error } = await supabaseAdmin
    .from("security_audit_logs")
    .select("event_type, outcome")
    .in("outcome", ["failure", "rate_limited"])
    .gte("created_at", new Date(now.getTime() - DIGEST_WINDOW_MS).toISOString())
    .limit(DIGEST_ROW_LIMIT);

  if (error) {
    throw new Error("Could not load security events for the alert digest.");
  }

  return (data || []) as DigestRow[];
}

export function buildSecurityAlertDigestText(rows: DigestRow[], now: Date): string {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = `${row.outcome === "failure" ? "Failure" : "Rate limited"}: ${row.event_type}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const lines = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => `${String(count).padStart(5)}  ${label}`);
  const failureCount = rows.filter((row) => row.outcome === "failure").length;
  const limitNote = rows.length >= DIGEST_ROW_LIMIT ? `\nOnly the first ${DIGEST_ROW_LIMIT} events were counted.` : "";

  return [
    `My Secret Santa security summary for the 24 hours before ${now.toISOString()}`,
    "",
    `${failureCount} failures and ${rows.length - failureCount} rate-limited requests were recorded.`,
    "",
    ...lines,
    limitNote,
    "",
    "Details are in the security_audit_logs table in Supabase.",
  ].join("\n");
}

export async function sendSecurityAlertDigest(now: Date): Promise<SecurityAlertDigestResult> {
  const recipient = getAlertRecipient();
  const { config } = readSmtpConfig();

  if (!recipient || !config) {
    return "not_configured";
  }

  if (await wasDigestSentRecently(now)) {
    return "already_sent";
  }

  const rows = await loadDigestRows(now);

  if (rows.length === 0) {
    return "nothing_to_report";
  }

  const failureCount = rows.filter((row) => row.outcome === "failure").length;
  await createSmtpTransport(config).sendMail({
    from: config.from,
    subject: `Security summary: ${failureCount} failures, ${rows.length - failureCount} rate-limited`,
    text: buildSecurityAlertDigestText(rows, now),
    to: recipient,
  });

  await recordAuditEvent({
    details: { eventCount: rows.length, failureCount },
    eventType: DIGEST_SENT_EVENT_TYPE,
    outcome: "success",
    resourceType: "security_alert_digest",
  });

  return "sent";
}
