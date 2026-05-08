import "server-only";

import { normalizeSafeAppPath } from "@/lib/security/web";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_LOCAL_APP_ORIGIN = "http://localhost:3000";

function normalizeHttpOrigin(candidate: string | null | undefined): string | null {
  const trimmed = candidate?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function getConfiguredAppOrigin(): string {
  return (
    normalizeHttpOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeHttpOrigin(process.env.APP_URL) ||
    normalizeHttpOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeHttpOrigin(process.env.VERCEL_URL) ||
    DEFAULT_LOCAL_APP_ORIGIN
  );
}

function getGroupInviteRedirectUrl(nextPath = "/dashboard"): string {
  const callbackUrl = new URL("/auth/callback", getConfiguredAppOrigin());
  callbackUrl.searchParams.set("next", normalizeSafeAppPath(nextPath, "/dashboard"));
  return callbackUrl.toString();
}

export async function sendGroupInviteEmail({
  email,
  groupId,
  groupName,
}: {
  email: string;
  groupId: string;
  groupName: string;
}) {
  return supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: getGroupInviteRedirectUrl("/dashboard"),
    data: {
      group_id: groupId,
      group_name: groupName,
      source: "app",
    },
  });
}

export async function findExistingInviteUserIdByEmail(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      return null;
    }

    const matchedUser = data.users.find(
      (candidateUser) => (candidateUser.email || "").toLowerCase() === normalizedEmail
    );

    if (matchedUser) {
      return matchedUser.id;
    }

    if (data.users.length < 200) {
      break;
    }
  }

  return null;
}
