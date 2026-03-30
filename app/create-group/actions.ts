"use server";

import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GROUP_NAME_MAX_LENGTH = 100;
const GROUP_DESCRIPTION_MAX_LENGTH = 300;
const GROUP_CURRENCY_MAX_LENGTH = 5;
const MAX_INVITES_PER_GROUP = 25;
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
};

type CreateGroupResult = {
  success: boolean;
  message: string;
};

function sanitizeText(input: string, maxLength: number): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, maxLength);
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
  groupId: string
): Promise<{ failedCount: number; sentCount: number }> {
  let sentCount = 0;
  let failedCount = 0;

  for (const email of emails) {
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

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

    sentCount += 1;
  }

  return { failedCount, sentCount };
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

  if (!cleanName) {
    return { success: false, message: "Group name is required." };
  }

  if (!input.eventDate || isPastDate(input.eventDate)) {
    return { success: false, message: "Event date must be today or later." };
  }

  if (!ALLOWED_CURRENCIES.has(cleanCurrency)) {
    return { success: false, message: "Choose a valid currency." };
  }

  const { data: newGroup, error: groupError } = await supabase
    .from("groups")
    .insert({
      name: cleanName,
      description: cleanDescription,
      event_date: input.eventDate,
      owner_id: user.id,
      invites: inviteEmails,
      budget: cleanBudget,
      currency: cleanCurrency,
    })
    .select("id")
    .single();

  if (groupError || !newGroup) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: groupError?.message || "Unknown group error",
      eventType: "group.create",
      resourceType: "group",
    });
    return { success: false, message: "Failed to create group. Please try again." };
  }

  const ownerEmail = (user.email || "").toLowerCase();
  const ownerNickname = ownerEmail.split("@")[0] || "owner";
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
      nickname: email.split("@")[0],
      role: "member",
      status: "pending",
    })),
  ];

  const { error: membersError } = await supabase.from("group_members").insert(memberRows);

  if (membersError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membersError.message,
      eventType: "group.create_members",
      resourceId: newGroup.id,
      resourceType: "group",
    });

    await supabase.from("groups").delete().eq("id", newGroup.id).eq("owner_id", user.id);

    return {
      success: false,
      message: "Failed to create the group members. Please try again.",
    };
  }

  if (inviteEmails.length === 0) {
    return { success: true, message: "Group created!" };
  }

  const { failedCount, sentCount } = await sendInviteEmails(inviteEmails, user.id, newGroup.id);

  await recordAuditEvent({
    actorUserId: user.id,
    details: {
      failedInviteCount: failedCount,
      groupId: newGroup.id,
      inviteCount: inviteEmails.length,
      sentInviteCount: sentCount,
    },
    eventType: "group.create",
    outcome: "success",
    resourceId: newGroup.id,
    resourceType: "group",
  });

  if (failedCount > 0) {
    return {
      success: true,
      message: `Group created. Sent ${sentCount} invite(s), ${failedCount} failed.`,
    };
  }

  return {
    success: true,
    message: `Group created. Sent ${sentCount} invite(s).`,
  };
}
