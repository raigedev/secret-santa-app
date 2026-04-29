import "server-only";

import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
export type ServerActionUser = NonNullable<
  Awaited<ReturnType<ServerSupabaseClient["auth"]["getUser"]>>["data"]["user"]
>;

export type ServerActionContext =
  | {
      ok: true;
      supabase: ServerSupabaseClient;
      user: ServerActionUser;
    }
  | {
      ok: false;
      message: string;
    };

export async function getServerActionContext(): Promise<ServerActionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "You must be logged in." };
  }

  return {
    ok: true,
    supabase,
    user,
  };
}

export async function requireRateLimitedAction(options: {
  action: string;
  maxAttempts: number;
  resourceId?: string | null | ((userId: string) => string | null);
  resourceType: string;
  subject: (userId: string) => string;
  windowSeconds: number;
}): Promise<ServerActionContext> {
  const context = await getServerActionContext();

  if (!context.ok) {
    return context;
  }

  const rateLimit = await enforceRateLimit({
    action: options.action,
    actorUserId: context.user.id,
    maxAttempts: options.maxAttempts,
    resourceId:
      typeof options.resourceId === "function"
        ? options.resourceId(context.user.id)
        : options.resourceId,
    resourceType: options.resourceType,
    subject: options.subject(context.user.id),
    windowSeconds: options.windowSeconds,
  });

  if (!rateLimit.allowed) {
    return { ok: false, message: rateLimit.message };
  }

  return context;
}
