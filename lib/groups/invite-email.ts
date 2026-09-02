import "server-only";

import { resolveTrustedAppOrigin } from "@/lib/security/app-origin";
import { normalizeSafePostAuthPath } from "@/lib/security/web";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type InviteAuthRecipient = {
  canReceiveInviteEmail: boolean;
  userId: string;
};

type InviteAuthRecipientRow = {
  can_receive_invite_email: boolean;
  normalized_email: string;
  user_id: string;
};

const MAX_INVITE_RECIPIENT_LOOKUPS = 50;

function getGroupInviteRedirectUrl(nextPath = "/dashboard"): string {
  const callbackUrl = new URL("/auth/callback", resolveTrustedAppOrigin(null));
  callbackUrl.searchParams.set("next", normalizeSafePostAuthPath(nextPath, "/dashboard"));
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

function normalizeInviteLookupEmails(emails: string[]): string[] {
  return Array.from(
    new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0 && email.length <= 100)
    )
  ).slice(0, MAX_INVITE_RECIPIENT_LOOKUPS);
}

export async function findInviteAuthRecipientsByEmail(
  emails: string[]
): Promise<Map<string, InviteAuthRecipient>> {
  const normalizedEmails = normalizeInviteLookupEmails(emails);
  const recipients = new Map<string, InviteAuthRecipient>();

  if (normalizedEmails.length === 0) {
    return recipients;
  }

  const { data, error } = await supabaseAdmin.rpc("lookup_invite_auth_recipients", {
    p_emails: normalizedEmails,
  });

  if (error) {
    throw new Error(`Invite recipient lookup failed: ${error.message}`);
  }

  for (const row of (data || []) as InviteAuthRecipientRow[]) {
    const normalizedEmail = row.normalized_email?.trim().toLowerCase();

    if (!normalizedEmail || !row.user_id) {
      continue;
    }

    recipients.set(normalizedEmail, {
      canReceiveInviteEmail: Boolean(row.can_receive_invite_email),
      userId: row.user_id,
    });
  }

  return recipients;
}

export async function findInviteAuthRecipientByEmail(
  email: string
): Promise<InviteAuthRecipient | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const recipients = await findInviteAuthRecipientsByEmail([normalizedEmail]);
  return recipients.get(normalizedEmail) || null;
}
