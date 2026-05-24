import "server-only";

import { resolveTrustedAppOrigin } from "@/lib/security/app-origin";
import { normalizeSafeAppPath } from "@/lib/security/web";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getGroupInviteRedirectUrl(nextPath = "/dashboard"): string {
  const callbackUrl = new URL("/auth/callback", resolveTrustedAppOrigin(null));
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
