"use server";

import {
  sanitizeGroupNickname,
  validateAnonymousGroupNickname,
} from "@/lib/groups/nickname";
import {
  findExistingInviteUserIdByEmail,
  sendGroupInviteEmail,
} from "@/lib/groups/invite-email";
import { createNotification } from "@/lib/notifications";
import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { MAX_GROUP_CREATION_INVITES } from "@/lib/groups/capacity";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sanitizePlainText } from "@/lib/validation/common";

const GROUP_NAME_MAX_LENGTH = 100;
const GROUP_DESCRIPTION_MAX_LENGTH = 300;
const GROUP_CURRENCY_MAX_LENGTH = 5;
const MAX_INVITES_PER_GROUP = MAX_GROUP_CREATION_INVITES;
const EMAIL_MAX_LENGTH = 100;
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "GBP", "PHP", "JPY", "AUD", "CAD"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CreateGroupInput = {
  budget: number;
  currency: string;
  description: string;
  eventDate: string;
  inviteEmails: string[];
  name: string;
  ownerCodename?: string;
  requireAnonymousNickname: boolean;
};

type CreateGroupResult = {
  success: boolean;
  message: string;
};

function sanitizeText(input: string, maxLength: number): string {
  return sanitizePlainText(input, maxLength);
}

function isPastDate(value: string): boolean {
  const parsedDate = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Number.isNaN(parsedDate.getTime()) || parsedDate < today;
}

function normalizeInviteEmails(rawEmails: string[], ownerEmail: string | null | undefined): string[] {
  const ownerEmailLower = ownerEmail?.toLowerCase() || "";
  const uniqueEmails = new Set<string>();

  for (const rawEmail of rawEmails) {
    const normalizedEmail = sanitizeText(rawEmail, EMAIL_MAX_LENGTH).toLowerCase();

    if (!normalizedEmail || normalizedEmail === ownerEmailLower) {
      continue;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      continue;
    }

    uniqueEmails.add(normalizedEmail);

    if (uniqueEmails.size >= MAX_INVITES_PER_GROUP) {
      break;
    }
  }

  return [...uniqueEmails];
}

async function sendInviteEmails(
  emails: string[],
  actorUserId: string,
  groupId: string,
  groupName: string
): Promise<{ dashboardInviteCount: number; emailInviteCount: number; failedCount: number }> {
  let dashboardInviteCount = 0;
  let emailInviteCount = 0;
  let failedCount = 0;

  for (const email of emails) {
    const existingUserId = await findExistingInviteUserIdByEmail(email);

    if (existingUserId) {
      await createNotification({
        userId: existingUserId,
        type: "invite",
        title: `New group invite: ${groupName}`,
        body: "You have a pending group invitation. Open your dashboard to accept or decline it.",
        linkPath: "/dashboard",
        metadata: {
          groupId,
        },
        preferenceKey: "notify_invites",
      });
      dashboardInviteCount += 1;
      continue;
    }

    const { error } = await sendGroupInviteEmail({
      email,
      groupId,
      groupName,
    });

    if (error) {
      await recordServerFailure({
        actorUserId,
        details: { invitedEmail: email },
        errorMessage: error.message,
        eventType: "group.invite_email",
        resourceId: groupId,
        resourceType: "group",
      });
      failedCount += 1;
      continue;
    }

    emailInviteCount += 1;
  }

  return { dashboardInviteCount, emailInviteCount, failedCount };
}

function getInviteDeliveryMessage(summary: {
  dashboardInviteCount: number;
  emailInviteCount: number;
  failedCount: number;
}): string {
  const totalPrepared = summary.dashboardInviteCount + summary.emailInviteCount;

  if (summary.failedCount > 0) {
    return `Group created. ${totalPrepared} invite(s) prepared, ${summary.failedCount} could not be delivered.`;
  }

  if (summary.dashboardInviteCount > 0 && summary.emailInviteCount > 0) {
    return `Group created. ${summary.emailInviteCount} email invite(s) sent; ${summary.dashboardInviteCount} existing member(s) will see it on their dashboard.`;
  }

  if (summary.dashboardInviteCount > 0) {
    return `Group created. ${summary.dashboardInviteCount} existing member(s) will see it on their dashboard.`;
  }

  return `Group created. ${summary.emailInviteCount} invite email(s) sent.`;
}

export async function createGroupWithInvites(
  input: CreateGroupInput
): Promise<CreateGroupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.create",
    actorUserId: user.id,
    maxAttempts: 5,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const cleanName = sanitizeText(input.name, GROUP_NAME_MAX_LENGTH);
  const cleanDescription = sanitizeText(input.description, GROUP_DESCRIPTION_MAX_LENGTH);
  const cleanCurrency = sanitizeText(input.currency, GROUP_CURRENCY_MAX_LENGTH).toUpperCase();
  const cleanBudget = Math.min(Math.max(Math.floor(input.budget || 0), 0), 100000);
  const inviteEmails = normalizeInviteEmails(input.inviteEmails || [], user.email);
  const requireAnonymousNickname = Boolean(input.requireAnonymousNickname);
  const cleanOwnerCodename = sanitizeGroupNickname(input.ownerCodename || "");

  if (!cleanName) {
    return { success: false, message: "Enter a group name." };
  }

  if (!input.eventDate || isPastDate(input.eventDate)) {
    return { success: false, message: "Event date must be today or later." };
  }

  if (!ALLOWED_CURRENCIES.has(cleanCurrency)) {
    return { success: false, message: "Choose a valid currency." };
  }

  if (requireAnonymousNickname) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const ownerCodenameMessage = validateAnonymousGroupNickname({
      nickname: cleanOwnerCodename,
      displayName: profile?.display_name || null,
      email: user.email || null,
    });

    if (ownerCodenameMessage) {
      return { success: false, message: ownerCodenameMessage };
    }
  }

  // Validate and authenticate with the caller's session first, then use the
  // admin client for the multi-table write so this flow does not break when
  // RLS or function grants are tightened later.
  const { data: newGroup, error: groupError } = await supabaseAdmin
    .from("groups")
    .insert({
      name: cleanName,
      description: cleanDescription,
      event_date: input.eventDate,
      owner_id: user.id,
      budget: cleanBudget,
      currency: cleanCurrency,
      require_anonymous_nickname: requireAnonymousNickname,
    })
    .select("id, name")
    .single();

  if (groupError || !newGroup) {
    await recordServerFailure({
      actorUserId: user.id,
      details: {
        dbCode: groupError?.code ?? null,
        dbDetails: groupError?.details ?? null,
        dbHint: groupError?.hint ?? null,
      },
      errorMessage: groupError?.message || "Unknown group error",
      eventType: "group.create",
      resourceType: "group",
    });

    return { success: false, message: "Failed to create group. Please try again." };
  }

  const ownerEmail = (user.email || "").toLowerCase();
  const ownerNickname = requireAnonymousNickname ? cleanOwnerCodename : null;

  const memberRows = [
    {
      group_id: newGroup.id,
      user_id: user.id,
      email: ownerEmail,
      nickname: ownerNickname,
      role: "owner",
      status: "accepted",
    },
    ...inviteEmails.map((email) => ({
      group_id: newGroup.id,
      user_id: null,
      email,
      nickname: null,
      role: "member",
      status: "pending",
    })),
  ];

  const { error: membersError } = await supabaseAdmin
    .from("group_members")
    .insert(memberRows);

  if (membersError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: {
        dbCode: membersError.code ?? null,
        dbDetails: membersError.details ?? null,
        dbHint: membersError.hint ?? null,
      },
      errorMessage: membersError.message,
      eventType: "group.create_members",
      resourceId: newGroup.id,
      resourceType: "group",
    });

    // If member creation fails after the group row exists, try to remove the
    // partially created group so the dashboard does not show an empty shell.
    await supabaseAdmin.from("groups").delete().eq("id", newGroup.id);

    return {
      success: false,
      message: "Failed to create the group members. Please try again.",
    };
  }

  if (inviteEmails.length === 0) {
    await recordAuditEvent({
      actorUserId: user.id,
      details: {
        failedInviteCount: 0,
        groupId: newGroup.id,
        inviteCount: 0,
        sentInviteCount: 0,
      },
      eventType: "group.create",
      outcome: "success",
      resourceId: newGroup.id,
      resourceType: "group",
    });

    return { success: true, message: "Group created!" };
  }

  const inviteDelivery = await sendInviteEmails(
    inviteEmails,
    user.id,
    newGroup.id,
    newGroup.name
  );

  await recordAuditEvent({
    actorUserId: user.id,
    details: {
      failedInviteCount: inviteDelivery.failedCount,
      groupId: newGroup.id,
      inviteCount: inviteEmails.length,
      sentInviteCount: inviteDelivery.emailInviteCount + inviteDelivery.dashboardInviteCount,
    },
    eventType: "group.create",
    outcome: "success",
    resourceId: newGroup.id,
    resourceType: "group",
  });

  return {
    success: true,
    message: getInviteDeliveryMessage(inviteDelivery),
  };
}
