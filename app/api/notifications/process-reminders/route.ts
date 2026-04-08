import { NextRequest, NextResponse } from "next/server";

import { syncAndProcessReminderJobs } from "@/lib/notifications";
import { recordServerFailure } from "@/lib/security/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorizedRequest(request: NextRequest): boolean {
  if (request.headers.has("x-vercel-cron")) {
    return true;
  }

  const configuredSecret = process.env.REMINDER_PROCESSOR_SECRET?.trim();
  const providedSecret =
    request.nextUrl.searchParams.get("token")?.trim() ||
    request.headers.get("x-reminder-processor-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (configuredSecret) {
    return Boolean(providedSecret) && providedSecret === configuredSecret;
  }

  return process.env.NODE_ENV !== "production";
}

async function handleRequest(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const stats = await syncAndProcessReminderJobs(now);

    return NextResponse.json(
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

    return NextResponse.json(
      {
        ok: false,
        error: message,
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
