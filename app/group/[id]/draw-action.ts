"use server";

import { randomInt } from "crypto";
import { isAssignmentAlreadyDrawnError } from "@/lib/groups/draw.mjs";
import { validateAnonymousGroupNickname } from "@/lib/groups/nickname";
import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { createNotifications } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DRAW_MAX_ATTEMPTS = 5;
const DRAW_WINDOW_SECONDS = 3600;

const RESET_DRAW_MAX_ATTEMPTS = 5;
const RESET_DRAW_WINDOW_SECONDS = 3600;
const MAX_DERANGEMENT_ATTEMPTS = 50;

type DrawMember = {
  nickname: string | null;
  user_id: string | null;
};

type DrawExclusionRow = {
  created_at: string;
  giver_user_id: string;
  id: string;
  receiver_user_id: string;
};

type DrawCycleRow = {
  assignment_count: number;
  avoid_previous_recipient: boolean;
  created_at: string;
  cycle_number: number;
  id: string;
  repeat_avoidance_relaxed: boolean;
};

type DrawResetHistoryRow = {
  assignment_count: number;
  confirmed_gift_count: number;
  created_at: string;
  id: string;
  reason: string;
};

type DrawCyclePairRow = {
  giver_id: string;
  receiver_id: string;
};

function buildBlockedPairKey(giverUserId: string, receiverUserId: string): string {
  return `${giverUserId}:${receiverUserId}`;
}

function shuffleInPlace<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function buildAssignmentsAttempt(
  groupId: string,
  members: DrawMember[],
  blockedPairs: Set<string>
) {
  const givers = [...members];
  const receivers = [...members];

  shuffleInPlace(givers);

  // Keep shuffling the receiver side until nobody is matched with themselves.
  // This produces a real random derangement instead of forcing one circular loop.
  for (let attempt = 0; attempt < MAX_DERANGEMENT_ATTEMPTS; attempt += 1) {
    shuffleInPlace(receivers);

    const hasInvalidMatch = givers.some((giver, index) => {
      const giverUserId = giver.user_id;
      const receiverUserId = receivers[index]?.user_id;

      if (!giverUserId || !receiverUserId) {
        return true;
      }

      if (giverUserId === receiverUserId) {
        return true;
      }

      return blockedPairs.has(buildBlockedPairKey(giverUserId, receiverUserId));
    });

    if (!hasInvalidMatch) {
      return givers.map((giver, index) => ({
        group_id: groupId,
        giver_id: giver.user_id,
        receiver_id: receivers[index]?.user_id,
      }));
    }
  }

  return null;
}

function buildRandomAssignments(
  groupId: string,
  members: DrawMember[],
  blockedPairs: Set<string>,
  preferredBlockedPairs: Set<string>
) {
  const blockedWithPreferred = new Set<string>([
    ...blockedPairs,
    ...preferredBlockedPairs,
  ]);

  const preferredAssignments = buildAssignmentsAttempt(
    groupId,
    members,
    blockedWithPreferred
  );

  if (preferredAssignments) {
    return {
      assignments: preferredAssignments,
      repeatAvoidanceRelaxed: false,
    };
  }

  if (preferredBlockedPairs.size === 0) {
    return null;
  }

  const relaxedAssignments = buildAssignmentsAttempt(groupId, members, blockedPairs);

  if (!relaxedAssignments) {
    return null;
  }

  return {
    assignments: relaxedAssignments,
    repeatAvoidanceRelaxed: true,
  };
}

async function getLatestCycleBlockedPairs(groupId: string): Promise<Set<string>> {
  const { data: latestCycle, error: latestCycleError } = await supabaseAdmin
    .from("group_draw_cycles")
    .select("id")
    .eq("group_id", groupId)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestCycleError || !latestCycle) {
    return new Set<string>();
  }

  const { data: pairs, error: pairsError } = await supabaseAdmin
    .from("group_draw_cycle_pairs")
    .select("giver_id, receiver_id")
    .eq("group_id", groupId)
    .eq("cycle_id", latestCycle.id);

  if (pairsError || !pairs) {
    return new Set<string>();
  }

  return new Set(
    (pairs as DrawCyclePairRow[])
      .map((pair) => buildBlockedPairKey(pair.giver_id, pair.receiver_id))
      .filter((value): value is string => Boolean(value))
  );
}

async function getNextDrawCycleNumber(groupId: string): Promise<number> {
  const { data: latestCycle } = await supabaseAdmin
    .from("group_draw_cycles")
    .select("cycle_number")
    .eq("group_id", groupId)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (latestCycle?.cycle_number || 0) + 1;
}

async function groupHasDrawStarted(groupId: string): Promise<boolean> {
  const { data: existingDraw } = await supabaseAdmin
    .from("assignments")
    .select("id")
    .eq("group_id", groupId)
    .limit(1);

  return Boolean(existingDraw && existingDraw.length > 0);
}

async function assertOwnerCanManageDrawRules(
  groupId: string,
  actorUserId: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== actorUserId) {
    return { ok: false, message: "Only the group owner can manage draw rules." };
  }

  if (await groupHasDrawStarted(groupId)) {
    return {
      ok: false,
      message: "Draw rules can only be changed before names are drawn.",
    };
  }

  return { ok: true };
}

export async function getDrawExclusions(groupId: string): Promise<{
  exclusions?: Array<{
    createdAt: string;
    giverNickname: string;
    giverUserId: string;
    id: string;
    receiverNickname: string;
    receiverUserId: string;
  }>;
  message: string;
  success: boolean;
}> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Invalid group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.get_draw_exclusions",
    actorUserId: user.id,
    maxAttempts: 300,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can view draw rules." };
  }

  const [{ data: exclusions, error: exclusionError }, { data: members, error: membersError }] =
    await Promise.all([
      supabaseAdmin
        .from("group_draw_exclusions")
        .select("id, giver_user_id, receiver_user_id, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("group_members")
        .select("user_id, nickname")
        .eq("group_id", groupId)
        .eq("status", "accepted"),
    ]);

  if (exclusionError || membersError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: {
        exclusionError: exclusionError?.message || null,
        membersError: membersError?.message || null,
      },
      errorMessage: "Failed to load draw exclusion rules.",
      eventType: "group.get_draw_exclusions",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load draw rules." };
  }

  const nicknameByUserId = new Map<string, string>();
  for (const member of members || []) {
    if (!member.user_id) {
      continue;
    }

    nicknameByUserId.set(member.user_id, member.nickname?.trim() || "Member");
  }

  const rows = (exclusions || []) as DrawExclusionRow[];

  return {
    success: true,
    message: "Draw rules loaded.",
    exclusions: rows.map((row) => ({
      id: row.id,
      giverUserId: row.giver_user_id,
      receiverUserId: row.receiver_user_id,
      giverNickname: nicknameByUserId.get(row.giver_user_id) || "Member",
      receiverNickname: nicknameByUserId.get(row.receiver_user_id) || "Member",
      createdAt: row.created_at,
    })),
  };
}

export async function addDrawExclusion(
  groupId: string,
  giverUserId: string,
  receiverUserId: string,
  bidirectional: boolean
): Promise<{ success: boolean; message: string }> {
  if (
    !groupId || !UUID_PATTERN.test(groupId) ||
    !giverUserId || !UUID_PATTERN.test(giverUserId) ||
    !receiverUserId || !UUID_PATTERN.test(receiverUserId)
  ) {
    return { success: false, message: "Invalid draw rule input." };
  }

  if (giverUserId === receiverUserId) {
    return { success: false, message: "A member cannot be excluded from themselves." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.add_draw_exclusion",
    actorUserId: user.id,
    maxAttempts: 60,
    resourceId: groupId,
    resourceType: "group",
    subject: `${user.id}:${groupId}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const permission = await assertOwnerCanManageDrawRules(groupId, user.id);
  if (!permission.ok) {
    return { success: false, message: permission.message || "Cannot update draw rules." };
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from("group_members")
    .select("user_id, status")
    .eq("group_id", groupId)
    .eq("status", "accepted");

  if (membersError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membersError.message,
      eventType: "group.add_draw_exclusion.members",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to validate group members." };
  }

  const acceptedUserIds = new Set(
    (members || []).map((member) => member.user_id).filter((value): value is string => Boolean(value))
  );

  if (!acceptedUserIds.has(giverUserId) || !acceptedUserIds.has(receiverUserId)) {
    return {
      success: false,
      message: "Draw rules can only be set for accepted members in this group.",
    };
  }

  const rows = [
    {
      group_id: groupId,
      giver_user_id: giverUserId,
      receiver_user_id: receiverUserId,
      created_by: user.id,
    },
  ];

  if (bidirectional) {
    rows.push({
      group_id: groupId,
      giver_user_id: receiverUserId,
      receiver_user_id: giverUserId,
      created_by: user.id,
    });
  }

  const { error: insertError } = await supabaseAdmin
    .from("group_draw_exclusions")
    .upsert(rows, { onConflict: "group_id,giver_user_id,receiver_user_id", ignoreDuplicates: true });

  if (insertError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { giverUserId, receiverUserId, bidirectional },
      errorMessage: insertError.message,
      eventType: "group.add_draw_exclusion",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to save draw rule." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { bidirectional, giverUserId, receiverUserId },
    eventType: "group.add_draw_exclusion",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return {
    success: true,
    message: bidirectional
      ? "✅ Draw exclusion rule saved in both directions."
      : "✅ Draw exclusion rule saved.",
  };
}

export async function removeDrawExclusion(
  groupId: string,
  exclusionId: string
): Promise<{ success: boolean; message: string }> {
  if (
    !groupId || !UUID_PATTERN.test(groupId) ||
    !exclusionId || !UUID_PATTERN.test(exclusionId)
  ) {
    return { success: false, message: "Invalid draw rule ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.remove_draw_exclusion",
    actorUserId: user.id,
    maxAttempts: 60,
    resourceId: groupId,
    resourceType: "group",
    subject: `${user.id}:${groupId}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const permission = await assertOwnerCanManageDrawRules(groupId, user.id);
  if (!permission.ok) {
    return { success: false, message: permission.message || "Cannot update draw rules." };
  }

  const { data: removedRows, error: deleteError } = await supabaseAdmin
    .from("group_draw_exclusions")
    .delete()
    .eq("id", exclusionId)
    .eq("group_id", groupId)
    .select("id");

  if (deleteError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { exclusionId },
      errorMessage: deleteError.message,
      eventType: "group.remove_draw_exclusion",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to remove draw rule." };
  }

  if (!removedRows || removedRows.length === 0) {
    return { success: false, message: "Draw rule was not found." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { exclusionId },
    eventType: "group.remove_draw_exclusion",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return { success: true, message: "✅ Draw exclusion rule removed." };
}

export async function drawSecretSanta(
  groupId: string,
  options?: {
    avoidPreviousRecipient?: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Invalid group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.draw_secret_santa",
    actorUserId: user.id,
    maxAttempts: DRAW_MAX_ATTEMPTS,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: DRAW_WINDOW_SECONDS,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, name, require_anonymous_nickname")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    return { success: false, message: "Group not found." };
  }

  if (group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can draw names." };
  }

  const { data: existingDraw } = await supabaseAdmin
    .from("assignments")
    .select("id")
    .eq("group_id", groupId)
    .limit(1);

  if (existingDraw && existingDraw.length > 0) {
    return { success: false, message: "Names have already been drawn for this group." };
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from("group_members")
    .select("user_id, nickname")
    .eq("group_id", groupId)
    .eq("status", "accepted");

  if (membersError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membersError.message,
      eventType: "group.draw_secret_santa.fetch_members",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load members." };
  }

  if (!members || members.length < 3) {
    return {
      success: false,
      message: "Need at least 3 accepted members to draw names.",
    };
  }

  if (group.require_anonymous_nickname) {
    const hasInvalidCodename = members.some(
      (member) => Boolean(validateAnonymousGroupNickname({ nickname: member.nickname || "" }))
    );

    if (hasInvalidCodename) {
      return {
        success: false,
        message: "Every participant, including the organizer, needs a codename before drawing names.",
      };
    }
  }

  const unlinkedMembers = members.filter((member) => !member.user_id);
  if (unlinkedMembers.length > 0) {
    return {
      success: false,
      message: `${unlinkedMembers.length} member(s) have not registered yet. All members must have accounts.`,
    };
  }

  const { data: nonAccepted } = await supabaseAdmin
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .neq("status", "accepted");

  if (nonAccepted && nonAccepted.length > 0) {
    return {
      success: false,
      message: "All invited members must accept before drawing names.",
    };
  }

  const { data: exclusions, error: exclusionsError } = await supabaseAdmin
    .from("group_draw_exclusions")
    .select("giver_user_id, receiver_user_id")
    .eq("group_id", groupId);

  if (exclusionsError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: exclusionsError.message,
      eventType: "group.draw_secret_santa.fetch_exclusions",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load draw rules. Please try again." };
  }

  const blockedPairs = new Set(
    (exclusions || [])
      .map((row) => {
        const giverUserId = row.giver_user_id;
        const receiverUserId = row.receiver_user_id;
        if (!giverUserId || !receiverUserId) {
          return null;
        }

        return buildBlockedPairKey(giverUserId, receiverUserId);
      })
      .filter((value): value is string => Boolean(value))
  );

  const shouldAvoidPreviousRecipient = Boolean(options?.avoidPreviousRecipient);
  const previousCyclePairs = shouldAvoidPreviousRecipient
    ? await getLatestCycleBlockedPairs(groupId)
    : new Set<string>();

  const buildResult = buildRandomAssignments(
    groupId,
    members,
    blockedPairs,
    previousCyclePairs
  );

  if (!buildResult) {
    await recordServerFailure({
      actorUserId: user.id,
      details: {
        avoidPreviousRecipient: shouldAvoidPreviousRecipient,
        memberCount: members.length,
      },
      errorMessage: "Failed to build a valid random derangement.",
      eventType: "group.draw_secret_santa.build_assignments",
      resourceId: groupId,
      resourceType: "group",
    });

    return {
      success: false,
      message: "Failed to generate a fair draw with the current exclusion rules. Please adjust rules and try again.",
    };
  }

  const { assignments, repeatAvoidanceRelaxed } = buildResult;

  const { error: insertError } = await supabaseAdmin.from("assignments").insert(assignments);

  if (insertError) {
    if (isAssignmentAlreadyDrawnError(insertError)) {
      return { success: false, message: "Names have already been drawn for this group." };
    }

    await recordServerFailure({
      actorUserId: user.id,
      details: { assignmentCount: assignments.length },
      errorMessage: insertError.message,
      eventType: "group.draw_secret_santa.save_assignments",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to save assignments. Please try again." };
  }

  const cycleNumber = await getNextDrawCycleNumber(groupId);
  const { data: insertedCycle, error: cycleInsertError } = await supabaseAdmin
    .from("group_draw_cycles")
    .insert({
      assignment_count: assignments.length,
      avoid_previous_recipient: shouldAvoidPreviousRecipient,
      created_by: user.id,
      cycle_number: cycleNumber,
      draw_source: cycleNumber === 1 ? "initial" : "reroll",
      group_id: groupId,
      repeat_avoidance_relaxed: repeatAvoidanceRelaxed,
    })
    .select("id")
    .maybeSingle();

  if (cycleInsertError || !insertedCycle) {
    await recordServerFailure({
      actorUserId: user.id,
      details: {
        assignmentCount: assignments.length,
        avoidPreviousRecipient: shouldAvoidPreviousRecipient,
        repeatAvoidanceRelaxed,
      },
      errorMessage: cycleInsertError?.message || "Cycle insert failed.",
      eventType: "group.draw_secret_santa.log_cycle",
      resourceId: groupId,
      resourceType: "group",
    });
  } else {
    const pairRows = assignments
      .filter(
        (assignment) =>
          Boolean(assignment.giver_id) &&
          Boolean(assignment.receiver_id)
      )
      .map((assignment) => ({
        cycle_id: insertedCycle.id,
        giver_id: assignment.giver_id,
        group_id: groupId,
        receiver_id: assignment.receiver_id,
      }));

    const { error: pairInsertError } = await supabaseAdmin
      .from("group_draw_cycle_pairs")
      .insert(pairRows);

    if (pairInsertError) {
      await recordServerFailure({
        actorUserId: user.id,
        details: {
          assignmentCount: assignments.length,
          cycleId: insertedCycle.id,
        },
        errorMessage: pairInsertError.message,
        eventType: "group.draw_secret_santa.log_cycle_pairs",
        resourceId: groupId,
        resourceType: "group",
      });
    }
  }

  await createNotifications(
    assignments
      .map((assignment) => assignment.giver_id)
      .filter((giverId): giverId is string => Boolean(giverId) && giverId !== user.id)
      .map((giverId) => ({
        userId: giverId,
        type: "draw",
        title: `Names were drawn in ${group.name}`,
        body: "Your recipient is ready. Open Secret Santa to see your assignment and start planning.",
        linkPath: "/secret-santa",
        metadata: {
          groupId,
        },
        preferenceKey: "notify_draws" as const,
      }))
  );

  await recordAuditEvent({
    actorUserId: user.id,
    details: {
      assignmentCount: assignments.length,
      avoidPreviousRecipient: shouldAvoidPreviousRecipient,
      repeatAvoidanceRelaxed,
    },
    eventType: "group.draw_secret_santa",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return {
    success: true,
    message: repeatAvoidanceRelaxed
      ? `✅ Names drawn! ${assignments.length} members assigned. Repeat-avoidance was relaxed because the current rules left no valid draw.`
      : `✅ Names drawn! ${assignments.length} members assigned.`,
  };
}

export async function resetSecretSantaDraw(
  groupId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Invalid group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 8) {
    return {
      success: false,
      message: "Please provide at least 8 characters explaining why you are resetting the draw.",
    };
  }

  if (trimmedReason.length > 300) {
    return {
      success: false,
      message: "Reset reason is too long. Please keep it under 300 characters.",
    };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.reset_secret_santa",
    actorUserId: user.id,
    maxAttempts: RESET_DRAW_MAX_ATTEMPTS,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: RESET_DRAW_WINDOW_SECONDS,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, revealed")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    return { success: false, message: "Group not found." };
  }

  if (group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can reset the draw." };
  }

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from("assignments")
    .select("id, gift_received")
    .eq("group_id", groupId);

  if (assignmentsError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: assignmentsError.message,
      eventType: "group.reset_secret_santa.fetch_assignments",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load the current draw." };
  }

  if (!assignments || assignments.length === 0) {
    return { success: false, message: "There is no active draw to reset." };
  }

  const assignmentCount = assignments.length;
  const confirmedGiftCount = assignments.filter((assignment) => assignment.gift_received).length;

  // A reset needs to clear chat state tied to the old assignment pairs,
  // otherwise stale anonymous threads survive into the next draw.
  const { error: threadReadsError } = await supabaseAdmin
    .from("thread_reads")
    .delete()
    .eq("group_id", groupId);

  if (threadReadsError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: threadReadsError.message,
      eventType: "group.reset_secret_santa.clear_thread_reads",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to clear thread read history." };
  }

  const { error: messagesError } = await supabaseAdmin
    .from("messages")
    .delete()
    .eq("group_id", groupId);

  if (messagesError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: messagesError.message,
      eventType: "group.reset_secret_santa.clear_messages",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to clear anonymous chat history." };
  }

  const { error: revealSessionError } = await supabaseAdmin
    .from("group_reveal_sessions")
    .delete()
    .eq("group_id", groupId);

  if (revealSessionError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: revealSessionError.message,
      eventType: "group.reset_secret_santa.clear_reveal_session",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to clear the live reveal session." };
  }

  const { error: deleteAssignmentsError } = await supabaseAdmin
    .from("assignments")
    .delete()
    .eq("group_id", groupId);

  if (deleteAssignmentsError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { assignmentCount },
      errorMessage: deleteAssignmentsError.message,
      eventType: "group.reset_secret_santa.delete_assignments",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to clear assignments." };
  }

  const { error: resetRevealError } = await supabaseAdmin
    .from("groups")
    .update({
      revealed: false,
      revealed_at: null,
    })
    .eq("id", groupId);

  if (resetRevealError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: resetRevealError.message,
      eventType: "group.reset_secret_santa.reset_reveal_state",
      resourceId: groupId,
      resourceType: "group",
    });

    return {
      success: false,
      message: "Assignments were cleared, but the group state was not fully reset.",
    };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: {
      assignmentCount,
      confirmedGiftCount,
      reason: trimmedReason,
    },
    eventType: "group.reset_secret_santa",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  const { error: resetLogError } = await supabaseAdmin.from("group_draw_resets").insert({
    assignment_count: assignmentCount,
    confirmed_gift_count: confirmedGiftCount,
    created_by: user.id,
    group_id: groupId,
    reason: trimmedReason,
  });

  if (resetLogError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: {
        assignmentCount,
        confirmedGiftCount,
      },
      errorMessage: resetLogError.message,
      eventType: "group.reset_secret_santa.log_reset",
      resourceId: groupId,
      resourceType: "group",
    });
  }

  return {
    success: true,
    message: `✅ Draw reset. Removed ${assignmentCount} assignment(s) and cleared anonymous chat history.`,
  };
}

export async function getDrawRerollHistory(
  groupId: string,
  options?: {
    cycleOffset?: number;
    pageSize?: number;
    resetOffset?: number;
  }
): Promise<{
  cycles?: Array<{
    assignmentCount: number;
    avoidPreviousRecipient: boolean;
    createdAt: string;
    cycleNumber: number;
    id: string;
    repeatAvoidanceRelaxed: boolean;
  }>;
  hasMoreCycles?: boolean;
  hasMoreResets?: boolean;
  message: string;
  resets?: Array<{
    assignmentCount: number;
    confirmedGiftCount: number;
    createdAt: string;
    id: string;
    reason: string;
  }>;
  success: boolean;
}> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Invalid group ID." };
  }

  const cycleOffset = Math.max(0, Math.floor(options?.cycleOffset || 0));
  const resetOffset = Math.max(0, Math.floor(options?.resetOffset || 0));
  const pageSize = Math.min(25, Math.max(1, Math.floor(options?.pageSize || 5)));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can view reroll history." };
  }

  const [{ data: cycleRows, error: cycleError }, { data: resetRows, error: resetError }] =
    await Promise.all([
      supabaseAdmin
        .from("group_draw_cycles")
        .select("id, cycle_number, created_at, assignment_count, avoid_previous_recipient, repeat_avoidance_relaxed")
        .eq("group_id", groupId)
        .order("cycle_number", { ascending: false })
        .range(cycleOffset, cycleOffset + pageSize),
      supabaseAdmin
        .from("group_draw_resets")
        .select("id, created_at, reason, assignment_count, confirmed_gift_count")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .range(resetOffset, resetOffset + pageSize),
    ]);

  if (cycleError || resetError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: {
        cycleError: cycleError?.message || null,
        resetError: resetError?.message || null,
      },
      errorMessage: "Failed to load reroll history.",
      eventType: "group.get_draw_reroll_history",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load reroll history." };
  }

  const cycleRowsTyped = (cycleRows || []) as DrawCycleRow[];
  const resetRowsTyped = (resetRows || []) as DrawResetHistoryRow[];

  const hasMoreCycles = cycleRowsTyped.length > pageSize;
  const hasMoreResets = resetRowsTyped.length > pageSize;

  return {
    success: true,
    message: "Reroll history loaded.",
    hasMoreCycles,
    hasMoreResets,
    cycles: cycleRowsTyped.slice(0, pageSize).map((row) => ({
      id: row.id,
      cycleNumber: row.cycle_number,
      createdAt: row.created_at,
      assignmentCount: row.assignment_count,
      avoidPreviousRecipient: row.avoid_previous_recipient,
      repeatAvoidanceRelaxed: row.repeat_avoidance_relaxed,
    })),
    resets: resetRowsTyped.slice(0, pageSize).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      reason: row.reason,
      assignmentCount: row.assignment_count,
      confirmedGiftCount: row.confirmed_gift_count,
    })),
  };
}
