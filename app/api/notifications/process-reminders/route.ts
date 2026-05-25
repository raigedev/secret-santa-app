import { NextRequest } from "next/server";

import { syncAndProcessReminderJobs } from "@/lib/notifications";
import { recordServerFailure } from "@/lib/security/audit";
import { isLocalCronBypassAllowed } from "@/lib/security/deployed-runtime";
import { noStoreJson } from "@/lib/security/no-store-response";
import { extractBearerToken, safeEqualSecret } from "@/lib/security/web";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorizedRequest(request: NextRequest): boolean {
  const authorizationToken = extractBearerToken(request.headers.get("authorization"));
  const cronSecret = process.env.CRON_SECRET?.trim();
  const processorSecret = process.env.REMINDER_PROCESSOR_SECRET?.trim();
  const headerSecret = request.headers.get("x-reminder-processor-secret")?.trim();
  const allowLocalBypass = isLocalCronBypassAllowed();

  if (cronSecret && safeEqualSecret(cronSecret, authorizationToken)) {
    return true;
  }

  if (processorSecret) {
    return (
      safeEqualSecret(processorSecret, headerSecret) ||
      safeEqualSecret(processorSecret, authorizationToken)
    );
  }

  if (allowLocalBypass && request.headers.has("x-vercel-cron")) {
    return true;
  }

  if (allowLocalBypass) {
    const queryToken = request.nextUrl.searchParams.get("token")?.trim();
    return processorSecret ? safeEqualSecret(processorSecret, queryToken) : true;
  }

  return false;
}

async function handleRequest(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const stats = await syncAndProcessReminderJobs(now);

    return noStoreJson(
      {
        ok: true,
        processedAt: now.toISOString(),
        stats,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown reminder processing error.";

    await recordServerFailure({
      details: {
        path: "/api/notifications/process-reminders",
      },
      errorMessage: message,
      eventType: "notifications.reminders.process_route",
      resourceType: "reminder_job",
    });

    return noStoreJson(
      {
        ok: false,
        error: "Reminder processing failed.",
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
