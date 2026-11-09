import "server-only";

import { createSmtpTransport, readSmtpConfig } from "@/lib/email/smtp";
import { resolveTrustedAppOrigin } from "@/lib/security/app-origin";
import { enforceRateLimit } from "@/lib/security/rate-limit";
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
  authRecipient,
}: {
  email: string;
  groupId: string;
  groupName: string;
  authRecipient: InviteAuthRecipient | null;
}): Promise<{ error: { message: string } | null }> {
  if (authRecipient && !authRecipient.canReceiveInviteEmail) {
    return sendRegisteredGroupInviteEmail(email, authRecipient.userId);
  }

  return supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: getGroupInviteRedirectUrl("/dashboard"),
    data: {
      group_id: groupId,
      group_name: groupName,
      source: "app",
    },
  });
}

async function sendRegisteredGroupInviteEmail(email: string, recipientId: string) {
  const { config } = readSmtpConfig();
  if (!config) {
    return { error: { message: "Invite email SMTP configuration is incomplete." } };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.invite_email_recipient",
    maxAttempts: 10,
    resourceType: "email",
    subject: recipientId,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { error: { message: "Invitation email delivery is temporarily limited." } };
  }

  const groupsUrl = new URL("/groups", resolveTrustedAppOrigin(null)).toString();
  const introduction = "You have a pending Secret Santa group invitation.";
  const instructions = "Open My Groups and sign in with this email address to accept or decline.";
  const transport = createSmtpTransport(config);

  try {
    await transport.sendMail({
      from: config.from,
      to: { name: "", address: email },
      subject: "You're invited to a Secret Santa group",
      text: `${introduction}\n\n${instructions}\n${groupsUrl}`,
      html: `<p>${introduction}</p><p>${instructions}</p><p><a href="${groupsUrl}">Open My Groups</a></p>`,
    });
    return { error: null };
  } catch {
    return { error: { message: "The mail server could not send the group invitation." } };
  }
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
