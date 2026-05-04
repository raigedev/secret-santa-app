import { recordServerFailure } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sanitizePlainText } from "@/lib/validation/common";

type NotificationPreferenceKey =
  | "notify_invites"
  | "notify_draws"
  | "notify_chat"
  | "notify_wishlist";

type ReminderType =
  | "wishlist_incomplete"
  | "event_tomorrow"
  | "post_draw";

export type ReminderDeliveryMode = "immediate" | "daily_digest";

type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  linkPath?: string | null;
  metadata?: Record<string, unknown>;
  preferenceKey?: NotificationPreferenceKey | null;
};

type NotificationPreferenceRow = Partial<Record<NotificationPreferenceKey, boolean>>;

type ReminderPreferenceSettings = {
  reminder_delivery_mode: ReminderDeliveryMode;
  reminder_event_tomorrow: boolean;
  reminder_post_draw: boolean;
  reminder_wishlist_incomplete: boolean;
};

type ReminderJobStatus = "pending" | "processing" | "sent" | "failed" | "skipped";

type ReminderJobInsert = {
  body: string;
  candidate_due_at: string;
  dedupe_key: string;
  delivery_mode_snapshot: ReminderDeliveryMode;
  due_at: string;
  group_id?: string | null;
  link_path?: string | null;
  metadata: Record<string, unknown>;
  next_attempt_at: string;
  reminder_type: ReminderType;
  title: string;
  user_id: string;
};

type ReminderJobRow = {
  attempt_count: number;
  body: string;
  candidate_due_at: string;
  dedupe_key: string;
  delivery_mode_snapshot: ReminderDeliveryMode;
  due_at: string;
  group_id: string | null;
  id: string;
  link_path: string | null;
  metadata: Record<string, unknown> | null;
  next_attempt_at: string | null;
  reminder_type: ReminderType;
  status: ReminderJobStatus;
  title: string;
  user_id: string;
};

type ReminderDeliveryStatus = "sent" | "failed" | "skipped";

type ReminderSyncStats = {
  enqueued: {
    eventTomorrow: number;
    postDraw: number;
    wishlistIncomplete: number;
  };
  processed: {
    failed: number;
    sent: number;
    skipped: number;
  };
};

type ReminderProfileRow = ReminderPreferenceSettings & {
  user_id: string;
};

type GroupSummary = {
  event_date: string;
  id: string;
  name: string;
};

type AssignmentReminderRow = {
  created_at: string;
  gift_prep_status: string | null;
  gift_received: boolean | null;
  giver_id: string;
  group_id: string;
};

type DrawCycleSummary = {
  created_at: string;
  cycle_number: number;
  group_id: string;
  id: string;
};

type MessageSummary = {
  created_at: string;
  group_id: string;
  sender_id: string;
  thread_giver_id: string;
};

type GroupMemberReminderRow = {
  group_id: string;
  user_id: string | null;
};

type WishlistReminderRow = {
  group_id: string;
  user_id: string;
};

const MANILA_TIME_ZONE = "Asia/Manila";
const DIGEST_HOUR_MANILA = 9;
const MAX_REMINDER_ATTEMPTS = 5;
const WISHLIST_REMINDER_WINDOW_DAYS = 14;
const POST_DRAW_REMINDER_DELAY_HOURS = 6;
const POST_DRAW_REMINDER_LOOK_BACK_DAYS = 14;

const REMINDER_TYPE_TO_PROFILE_KEY: Record<
  ReminderType,
  keyof Pick<
    ReminderPreferenceSettings,
    "reminder_event_tomorrow" | "reminder_post_draw" | "reminder_wishlist_incomplete"
  >
> = {
  event_tomorrow: "reminder_event_tomorrow",
  post_draw: "reminder_post_draw",
  wishlist_incomplete: "reminder_wishlist_incomplete",
};

function sanitizeNotificationText(value: string, maxLength: number): string {
  return sanitizePlainText(value, maxLength);
}

function sanitizeMetadata(
  value: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getDefaultReminderPreferences(): ReminderPreferenceSettings {
  return {
    reminder_delivery_mode: "immediate",
    reminder_event_tomorrow: true,
    reminder_post_draw: true,
    reminder_wishlist_incomplete: true,
  };
}

function normalizeReminderPreferences(
  row: Partial<ReminderPreferenceSettings> | null | undefined
): ReminderPreferenceSettings {
  const defaults = getDefaultReminderPreferences();

  return {
    reminder_delivery_mode:
      row?.reminder_delivery_mode === "daily_digest"
        ? "daily_digest"
        : defaults.reminder_delivery_mode,
    reminder_event_tomorrow:
      typeof row?.reminder_event_tomorrow === "boolean"
        ? row.reminder_event_tomorrow
        : defaults.reminder_event_tomorrow,
    reminder_post_draw:
      typeof row?.reminder_post_draw === "boolean"
        ? row.reminder_post_draw
        : defaults.reminder_post_draw,
    reminder_wishlist_incomplete:
      typeof row?.reminder_wishlist_incomplete === "boolean"
        ? row.reminder_wishlist_incomplete
        : defaults.reminder_wishlist_incomplete,
  };
}

function isReminderEnabled(
  preferences: ReminderPreferenceSettings,
  reminderType: ReminderType
): boolean {
  return Boolean(preferences[REMINDER_TYPE_TO_PROFILE_KEY[reminderType]]);
}

function getManilaDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
  }).format(date);
}

function addDaysToDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildManilaDigestInstant(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map((value) => Number(value));
  return new Date(Date.UTC(year, month - 1, day, DIGEST_HOUR_MANILA - 8, 0, 0, 0));
}

function buildReminderRetryAt(attemptCount: number, now: Date): string | null {
  if (attemptCount >= MAX_REMINDER_ATTEMPTS) {
    return null;
  }

  const retryMinutes = Math.min(15 * 2 ** Math.max(attemptCount - 1, 0), 360);
  return new Date(now.getTime() + retryMinutes * 60_000).toISOString();
}

function scheduleReminderDueAt(
  candidateDueAt: Date,
  deliveryMode: ReminderDeliveryMode
): Date {
  if (deliveryMode === "immediate") {
    return candidateDueAt;
  }

  const candidateDate = getManilaDateString(candidateDueAt);
  const sameDayDigest = buildManilaDigestInstant(candidateDate);

  if (candidateDueAt.getTime() <= sameDayDigest.getTime()) {
    return sameDayDigest;
  }

  return buildManilaDigestInstant(addDaysToDateString(candidateDate, 1));
}

function buildNotificationTypeForReminder(reminderType: ReminderType): string {
  switch (reminderType) {
    case "event_tomorrow":
      return "reminder_event_tomorrow";
    case "post_draw":
      return "reminder_post_draw";
    case "wishlist_incomplete":
      return "reminder_wishlist_incomplete";
    default:
      return "reminder";
  }
}

async function shouldSendNotification(
  userId: string,
  preferenceKey: NotificationPreferenceKey | null | undefined
): Promise<boolean> {
  if (!preferenceKey) {
    return true;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(preferenceKey)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      details: { preferenceKey },
      errorMessage: error.message,
      eventType: "notifications.preference_lookup",
      resourceId: userId,
      resourceType: "profile",
    });

    return true;
  }

  const typedData = data as NotificationPreferenceRow | null;

  if (!typedData || typeof typedData[preferenceKey] !== "boolean") {
    return true;
  }

  return Boolean(typedData[preferenceKey]);
}

export async function createNotification(input: NotificationInput): Promise<string | null> {
  const userId = input.userId?.trim();

  if (!userId) {
    return null;
  }

  if (!(await shouldSendNotification(userId, input.preferenceKey))) {
    return null;
  }

  const title = sanitizeNotificationText(input.title, 120);
  const body = sanitizeNotificationText(input.body, 240);
  const linkPath = input.linkPath ? sanitizeNotificationText(input.linkPath, 200) : null;

  if (!title) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      body,
      link_path: linkPath,
      metadata: sanitizeMetadata(input.metadata),
      title,
      type: sanitizeNotificationText(input.type, 50) || "general",
      user_id: userId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      details: {
        linkPath,
        type: input.type,
      },
      errorMessage: error.message,
      eventType: "notifications.create",
      resourceId: userId,
      resourceType: "notification",
    });
    return null;
  }

  return (data?.id as string | undefined) || null;
}

export async function createNotifications(inputs: NotificationInput[]): Promise<void> {
  await Promise.all(inputs.map((input) => createNotification(input)));
}

async function loadReminderPreferencesMap(
  userIds: string[]
): Promise<Map<string, ReminderPreferenceSettings>> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const preferenceMap = new Map<string, ReminderPreferenceSettings>();

  if (uniqueUserIds.length === 0) {
    return preferenceMap;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "user_id, reminder_wishlist_incomplete, reminder_event_tomorrow, reminder_post_draw, reminder_delivery_mode"
    )
    .in("user_id", uniqueUserIds);

  if (error) {
    await recordServerFailure({
      errorMessage: error.message,
      eventType: "notifications.reminder_preferences.lookup",
      resourceType: "profile",
      details: {
        userCount: uniqueUserIds.length,
      },
    });

    return preferenceMap;
  }

  for (const row of (data || []) as ReminderProfileRow[]) {
    preferenceMap.set(row.user_id, normalizeReminderPreferences(row));
  }

  return preferenceMap;
}

export async function getReminderPreferencesForUser(
  userId: string
): Promise<ReminderPreferenceSettings> {
  const preferenceMap = await loadReminderPreferencesMap([userId]);
  return preferenceMap.get(userId) || getDefaultReminderPreferences();
}

async function insertReminderJob(job: ReminderJobInsert): Promise<boolean> {
  const { error } = await supabaseAdmin.from("reminder_jobs").upsert(job, {
    ignoreDuplicates: true,
    onConflict: "dedupe_key",
  });

  if (error) {
    await recordServerFailure({
      actorUserId: job.user_id,
      details: {
        dedupeKey: job.dedupe_key,
        reminderType: job.reminder_type,
      },
      errorMessage: error.message,
      eventType: "notifications.reminder_job.enqueue",
      resourceId: job.group_id || job.user_id,
      resourceType: "reminder_job",
    });

    return false;
  }

  return true;
}

function buildEventTomorrowCandidateDueAt(eventDate: string): Date {
  const dueAt = buildManilaDigestInstant(eventDate);
  dueAt.setUTCDate(dueAt.getUTCDate() - 1);
  return dueAt;
}

async function enqueueEventTomorrowReminderJobs(now: Date): Promise<number> {
  const tomorrow = addDaysToDateString(getManilaDateString(now), 1);
  const { data: groups, error: groupError } = await supabaseAdmin
    .from("groups")
    .select("id, name, event_date")
    .eq("event_date", tomorrow);

  if (groupError) {
    await recordServerFailure({
      errorMessage: groupError.message,
      eventType: "notifications.reminders.event_tomorrow.groups",
      resourceType: "group",
    });
    return 0;
  }

  const typedGroups = (groups || []) as GroupSummary[];
  if (typedGroups.length === 0) {
    return 0;
  }

  const groupIds = typedGroups.map((group) => group.id);
  const { data: members, error: memberError } = await supabaseAdmin
    .from("group_members")
    .select("group_id, user_id")
    .in("group_id", groupIds)
    .eq("status", "accepted")
    .not("user_id", "is", null);

  if (memberError) {
    await recordServerFailure({
      errorMessage: memberError.message,
      eventType: "notifications.reminders.event_tomorrow.members",
      resourceType: "group_membership",
    });
    return 0;
  }

  const typedMembers = (members || []) as GroupMemberReminderRow[];
  const preferenceMap = await loadReminderPreferencesMap(
    typedMembers.map((member) => member.user_id || "").filter(Boolean)
  );
  const groupById = new Map(typedGroups.map((group) => [group.id, group]));
  let enqueued = 0;

  for (const member of typedMembers) {
    const userId = member.user_id;
    const group = groupById.get(member.group_id);

    if (!userId || !group) {
      continue;
    }

    const preferences = preferenceMap.get(userId) || getDefaultReminderPreferences();
    if (!preferences.reminder_event_tomorrow) {
      continue;
    }

    const candidateDueAt = buildEventTomorrowCandidateDueAt(group.event_date);
    const scheduledDueAt = scheduleReminderDueAt(
      candidateDueAt,
      preferences.reminder_delivery_mode
    );

    const inserted = await insertReminderJob({
      body: `Your Secret Santa exchange for ${group.name} is tomorrow. Double-check your gift, wrapping, and meetup plan today.`,
      candidate_due_at: candidateDueAt.toISOString(),
      dedupe_key: `event_tomorrow:${group.id}:${userId}:${group.event_date}`,
      delivery_mode_snapshot: preferences.reminder_delivery_mode,
      due_at: scheduledDueAt.toISOString(),
      group_id: group.id,
      link_path: `/group/${group.id}`,
      metadata: {
        eventDate: group.event_date,
        groupId: group.id,
        groupName: group.name,
      },
      next_attempt_at: scheduledDueAt.toISOString(),
      reminder_type: "event_tomorrow",
      title: `Exchange day is tomorrow for ${group.name}`,
      user_id: userId,
    });

    if (inserted) {
      enqueued += 1;
    }
  }

  return enqueued;
}

async function enqueueWishlistIncompleteReminderJobs(now: Date): Promise<number> {
  const today = getManilaDateString(now);
  const windowEnd = addDaysToDateString(today, WISHLIST_REMINDER_WINDOW_DAYS);
  const { data: groups, error: groupError } = await supabaseAdmin
    .from("groups")
    .select("id, name, event_date")
    .gte("event_date", today)
    .lte("event_date", windowEnd);

  if (groupError) {
    await recordServerFailure({
      errorMessage: groupError.message,
      eventType: "notifications.reminders.wishlist_incomplete.groups",
      resourceType: "group",
    });
    return 0;
  }

  const typedGroups = (groups || []) as GroupSummary[];
  if (typedGroups.length === 0) {
    return 0;
  }

  const groupIds = typedGroups.map((group) => group.id);
  const [membersResult, wishlistsResult] = await Promise.all([
    supabaseAdmin
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds)
      .eq("status", "accepted")
      .not("user_id", "is", null),
    supabaseAdmin.from("wishlists").select("group_id, user_id").in("group_id", groupIds),
  ]);

  if (membersResult.error) {
    await recordServerFailure({
      errorMessage: membersResult.error.message,
      eventType: "notifications.reminders.wishlist_incomplete.members",
      resourceType: "group_membership",
    });
    return 0;
  }

  if (wishlistsResult.error) {
    await recordServerFailure({
      errorMessage: wishlistsResult.error.message,
      eventType: "notifications.reminders.wishlist_incomplete.wishlists",
      resourceType: "wishlist",
    });
    return 0;
  }

  const typedMembers = (membersResult.data || []) as GroupMemberReminderRow[];
  const typedWishlists = (wishlistsResult.data || []) as WishlistReminderRow[];
  const groupById = new Map(typedGroups.map((group) => [group.id, group]));
  const usersWithWishlist = new Set(
    typedWishlists.map((wishlist) => `${wishlist.group_id}:${wishlist.user_id}`)
  );
  const preferenceMap = await loadReminderPreferencesMap(
    typedMembers.map((member) => member.user_id || "").filter(Boolean)
  );
  const candidateDueAt = now;
  let enqueued = 0;

  for (const member of typedMembers) {
    const userId = member.user_id;
    const group = groupById.get(member.group_id);

    if (!userId || !group) {
      continue;
    }

    if (usersWithWishlist.has(`${group.id}:${userId}`)) {
      continue;
    }

    const preferences = preferenceMap.get(userId) || getDefaultReminderPreferences();
    if (!preferences.reminder_wishlist_incomplete) {
      continue;
    }

    const scheduledDueAt = scheduleReminderDueAt(
      candidateDueAt,
      preferences.reminder_delivery_mode
    );

    const inserted = await insertReminderJob({
      body: `Add at least one wishlist item for ${group.name} so your Santa has clear gift ideas before the exchange.`,
      candidate_due_at: candidateDueAt.toISOString(),
      dedupe_key: `wishlist_incomplete:${group.id}:${userId}:${today}`,
      delivery_mode_snapshot: preferences.reminder_delivery_mode,
      due_at: scheduledDueAt.toISOString(),
      group_id: group.id,
      link_path: "/wishlist",
      metadata: {
        eventDate: group.event_date,
        groupId: group.id,
        groupName: group.name,
      },
      next_attempt_at: scheduledDueAt.toISOString(),
      reminder_type: "wishlist_incomplete",
      title: `Add wishlist ideas for ${group.name}`,
      user_id: userId,
    });

    if (inserted) {
      enqueued += 1;
    }
  }

  return enqueued;
}

async function enqueuePostDrawReminderJobs(now: Date): Promise<number> {
  const today = getManilaDateString(now);
  const cycleWindowStart = new Date(
    now.getTime() - POST_DRAW_REMINDER_LOOK_BACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const assignmentsResult = await supabaseAdmin
    .from("assignments")
    .select("group_id, giver_id, gift_prep_status, gift_received, created_at")
    .gte("created_at", cycleWindowStart)
    .is("gift_prep_status", null)
    .or("gift_received.is.null,gift_received.eq.false");

  if (assignmentsResult.error) {
    await recordServerFailure({
      errorMessage: assignmentsResult.error.message,
      eventType: "notifications.reminders.post_draw.assignments",
      resourceType: "assignment",
    });
    return 0;
  }

  const recentPendingAssignments = (assignmentsResult.data || []) as AssignmentReminderRow[];

  if (recentPendingAssignments.length === 0) {
    return 0;
  }

  const candidateGroupIds = [...new Set(recentPendingAssignments.map((row) => row.group_id))];
  const [groupsResult, cyclesResult] = await Promise.all([
    supabaseAdmin
      .from("groups")
      .select("id, name, event_date")
      .in("id", candidateGroupIds)
      .gte("event_date", today),
    supabaseAdmin
      .from("group_draw_cycles")
      .select("id, group_id, cycle_number, created_at")
      .in("group_id", candidateGroupIds)
      .gte("created_at", cycleWindowStart)
      .order("group_id", { ascending: true })
      .order("cycle_number", { ascending: false }),
  ]);

  if (groupsResult.error) {
    await recordServerFailure({
      errorMessage: groupsResult.error.message,
      eventType: "notifications.reminders.post_draw.groups",
      resourceType: "group",
    });
    return 0;
  }

  if (cyclesResult.error) {
    await recordServerFailure({
      errorMessage: cyclesResult.error.message,
      eventType: "notifications.reminders.post_draw.cycles",
      resourceType: "group",
    });
    return 0;
  }

  const currentGroups = new Map(
    ((groupsResult.data || []) as GroupSummary[]).map((group) => [group.id, group])
  );
  const typedAssignments = recentPendingAssignments.filter((assignment) =>
    currentGroups.has(assignment.group_id)
  );

  const currentGroupIds = [...currentGroups.keys()];

  if (typedAssignments.length === 0 || currentGroupIds.length === 0) {
    return 0;
  }

  const latestCycleByGroup = new Map<string, DrawCycleSummary>();

  for (const cycle of (cyclesResult.data || []) as DrawCycleSummary[]) {
    if (!currentGroups.has(cycle.group_id) || latestCycleByGroup.has(cycle.group_id)) {
      continue;
    }

    latestCycleByGroup.set(cycle.group_id, cycle);
  }

  const assignmentGiverIds = [...new Set(typedAssignments.map((assignment) => assignment.giver_id))];
  const earliestRelevantMessageAt = typedAssignments.reduce<string | null>(
    (earliest, assignment) => {
      const cycle = latestCycleByGroup.get(assignment.group_id);
      const sourceCreatedAt = cycle?.created_at || assignment.created_at;

      return earliest && earliest <= sourceCreatedAt ? earliest : sourceCreatedAt;
    },
    null
  );

  if (!earliestRelevantMessageAt) {
    return 0;
  }

  const messagesResult = await supabaseAdmin
    .from("messages")
    .select("group_id, sender_id, thread_giver_id, created_at")
    .in("group_id", currentGroupIds)
    .in("sender_id", assignmentGiverIds)
    .in("thread_giver_id", assignmentGiverIds)
    .gte("created_at", earliestRelevantMessageAt);

  if (messagesResult.error) {
    await recordServerFailure({
      errorMessage: messagesResult.error.message,
      eventType: "notifications.reminders.post_draw.messages",
      resourceType: "message_thread",
    });
    return 0;
  }

  const latestMessageAtByGiver = new Map<string, string>();

  for (const message of (messagesResult.data || []) as MessageSummary[]) {
    if (message.sender_id !== message.thread_giver_id) {
      continue;
    }

    const key = `${message.group_id}:${message.thread_giver_id}`;
    const currentLatest = latestMessageAtByGiver.get(key);

    if (!currentLatest || currentLatest < message.created_at) {
      latestMessageAtByGiver.set(key, message.created_at);
    }
  }
  const preferenceMap = await loadReminderPreferencesMap(
    assignmentGiverIds
  );
  let enqueued = 0;

  for (const assignment of typedAssignments) {
    const group = currentGroups.get(assignment.group_id);
    if (!group) {
      continue;
    }

    if (assignment.gift_received || assignment.gift_prep_status) {
      continue;
    }

    const preferences =
      preferenceMap.get(assignment.giver_id) || getDefaultReminderPreferences();
    if (!preferences.reminder_post_draw) {
      continue;
    }

    const cycle = latestCycleByGroup.get(assignment.group_id);
    const cycleMarker = cycle
      ? `cycle${cycle.cycle_number}`
      : `legacy-${assignment.created_at.slice(0, 19)}`;
    const sourceCreatedAt = cycle?.created_at || assignment.created_at;
    const latestMessageAt = latestMessageAtByGiver.get(
      `${assignment.group_id}:${assignment.giver_id}`
    );

    if (latestMessageAt && latestMessageAt >= sourceCreatedAt) {
      continue;
    }

    const candidateDueAt = new Date(sourceCreatedAt);
    candidateDueAt.setHours(candidateDueAt.getHours() + POST_DRAW_REMINDER_DELAY_HOURS);
    const scheduledDueAt = scheduleReminderDueAt(
      candidateDueAt,
      preferences.reminder_delivery_mode
    );

    const inserted = await insertReminderJob({
      body: `Your recipient for ${group.name} is ready. Review their wishlist or send a private message so you can start planning.`,
      candidate_due_at: candidateDueAt.toISOString(),
      dedupe_key: `post_draw:${assignment.group_id}:${assignment.giver_id}:${cycleMarker}`,
      delivery_mode_snapshot: preferences.reminder_delivery_mode,
      due_at: scheduledDueAt.toISOString(),
      group_id: assignment.group_id,
      link_path: "/secret-santa",
      metadata: {
        cycleId: cycle?.id || null,
        cycleNumber: cycle?.cycle_number || null,
        groupId: assignment.group_id,
        groupName: group.name,
      },
      next_attempt_at: scheduledDueAt.toISOString(),
      reminder_type: "post_draw",
      title: `Plan your gift for ${group.name}`,
      user_id: assignment.giver_id,
    });

    if (inserted) {
      enqueued += 1;
    }
  }

  return enqueued;
}

function buildDailyDigestNotificationInput(jobs: ReminderJobRow[]): NotificationInput {
  const counts = {
    eventTomorrow: 0,
    postDraw: 0,
    wishlistIncomplete: 0,
  };

  const groupNames = new Set<string>();

  for (const job of jobs) {
    if (job.reminder_type === "event_tomorrow") {
      counts.eventTomorrow += 1;
    } else if (job.reminder_type === "post_draw") {
      counts.postDraw += 1;
    } else if (job.reminder_type === "wishlist_incomplete") {
      counts.wishlistIncomplete += 1;
    }

    const maybeGroupName = job.metadata?.groupName;
    if (typeof maybeGroupName === "string" && maybeGroupName.trim()) {
      groupNames.add(maybeGroupName.trim());
    }
  }

  const summaryParts: string[] = [];

  if (counts.eventTomorrow > 0) {
    summaryParts.push(
      `${counts.eventTomorrow} gift date${counts.eventTomorrow === 1 ? "" : "s"} tomorrow`
    );
  }

  if (counts.wishlistIncomplete > 0) {
    summaryParts.push(
      `${counts.wishlistIncomplete} wishlist reminder${counts.wishlistIncomplete === 1 ? "" : "s"}`
    );
  }

  if (counts.postDraw > 0) {
    summaryParts.push(
      `${counts.postDraw} planning reminder${counts.postDraw === 1 ? "" : "s"}`
    );
  }

  const groupPreview = [...groupNames].slice(0, 2).join(", ");
  const title =
    jobs.length === 1
      ? "You have 1 Secret Santa reminder"
      : `You have ${jobs.length} Secret Santa reminders`;
  const bodyBase =
    summaryParts.length > 0
      ? `${summaryParts.join(", ")} are ready for review.`
      : "You have new Secret Santa reminders ready for review.";
  const body =
    groupPreview.length > 0
      ? `${bodyBase} Groups: ${groupPreview}${groupNames.size > 2 ? " and more" : ""}.`
      : bodyBase;

  return {
    body: sanitizeNotificationText(body, 240),
    linkPath: "/notifications",
    metadata: {
      groupCount: groupNames.size,
      jobIds: jobs.map((job) => job.id),
      reminderTypes: jobs.map((job) => job.reminder_type),
      summary: counts,
    },
    title: sanitizeNotificationText(title, 120),
    type: "reminder_digest",
    userId: jobs[0].user_id,
  };
}

async function claimReminderJob(job: ReminderJobRow, now: Date): Promise<ReminderJobRow | null> {
  const nowIso = now.toISOString();
  const nextAttemptCount = Number(job.attempt_count || 0) + 1;
  const { data, error } = await supabaseAdmin
    .from("reminder_jobs")
    .update({
      attempt_count: nextAttemptCount,
      last_attempt_at: nowIso,
      status: "processing",
      updated_at: nowIso,
    })
    .eq("id", job.id)
    .eq("attempt_count", job.attempt_count)
    .eq("status", job.status)
    .select(
      "id, user_id, reminder_type, group_id, dedupe_key, title, body, link_path, metadata, candidate_due_at, due_at, next_attempt_at, delivery_mode_snapshot, attempt_count, status"
    )
    .maybeSingle();

  if (error) {
    await recordServerFailure({
      actorUserId: job.user_id,
      details: {
        dedupeKey: job.dedupe_key,
        reminderType: job.reminder_type,
      },
      errorMessage: error.message,
      eventType: "notifications.reminder_job.claim",
      resourceId: job.id,
      resourceType: "reminder_job",
    });
    return null;
  }

  return (data as ReminderJobRow | null) || null;
}

async function markReminderJobSent(jobId: string, now: Date): Promise<void> {
  await supabaseAdmin
    .from("reminder_jobs")
    .update({
      last_error: null,
      next_attempt_at: null,
      processed_at: now.toISOString(),
      status: "sent",
      updated_at: now.toISOString(),
    })
    .eq("id", jobId);
}

async function markReminderJobSkipped(
  jobId: string,
  reason: string,
  now: Date
): Promise<void> {
  await supabaseAdmin
    .from("reminder_jobs")
    .update({
      last_error: sanitizeNotificationText(reason, 300),
      next_attempt_at: null,
      processed_at: now.toISOString(),
      status: "skipped",
      updated_at: now.toISOString(),
    })
    .eq("id", jobId);
}

async function markReminderJobFailed(
  job: ReminderJobRow,
  errorMessage: string,
  now: Date
): Promise<void> {
  await supabaseAdmin
    .from("reminder_jobs")
    .update({
      last_error: sanitizeNotificationText(errorMessage, 300),
      next_attempt_at: buildReminderRetryAt(job.attempt_count, now),
      status: "failed",
      updated_at: now.toISOString(),
    })
    .eq("id", job.id);
}

async function rescheduleReminderJobForMode(
  job: ReminderJobRow,
  deliveryMode: ReminderDeliveryMode,
  now: Date
): Promise<void> {
  const candidateDueAt = new Date(job.candidate_due_at);
  const nextDueAt = scheduleReminderDueAt(candidateDueAt, deliveryMode).toISOString();

  await supabaseAdmin
    .from("reminder_jobs")
    .update({
      delivery_mode_snapshot: deliveryMode,
      due_at: nextDueAt,
      last_error: null,
      next_attempt_at: nextDueAt,
      status: "pending",
      updated_at: now.toISOString(),
    })
    .eq("id", job.id);
}

async function insertReminderDelivery(params: {
  dedupeKey: string;
  deliveryMode: ReminderDeliveryMode;
  errorMessage?: string | null;
  job: ReminderJobRow;
  notificationId?: string | null;
  payload?: Record<string, unknown>;
  status: ReminderDeliveryStatus;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from("reminder_deliveries").insert({
    dedupe_key: params.dedupeKey,
    delivery_mode: params.deliveryMode,
    error_message: params.errorMessage
      ? sanitizeNotificationText(params.errorMessage, 500)
      : null,
    notification_id: params.notificationId || null,
    payload: sanitizeMetadata(params.payload),
    reminder_job_id: params.job.id,
    reminder_type: params.job.reminder_type,
    status: params.status,
    user_id: params.job.user_id,
  });

  if (!error || error.code === "23505") {
    return true;
  }

  await recordServerFailure({
    actorUserId: params.job.user_id,
    details: {
      dedupeKey: params.dedupeKey,
      reminderType: params.job.reminder_type,
      status: params.status,
    },
    errorMessage: error.message,
    eventType: "notifications.reminder_delivery.insert",
    resourceId: params.job.id,
    resourceType: "reminder_delivery",
  });

  return false;
}

async function processImmediateReminderJob(
  job: ReminderJobRow,
  preferences: ReminderPreferenceSettings,
  now: Date
): Promise<ReminderDeliveryStatus> {
  if (!isReminderEnabled(preferences, job.reminder_type)) {
    await insertReminderDelivery({
      dedupeKey: job.dedupe_key,
      deliveryMode: preferences.reminder_delivery_mode,
      job,
      payload: { reason: "disabled_by_preference" },
      status: "skipped",
    });
    await markReminderJobSkipped(job.id, "Reminder disabled by preference.", now);
    return "skipped";
  }

  if (preferences.reminder_delivery_mode !== job.delivery_mode_snapshot) {
    await rescheduleReminderJobForMode(job, preferences.reminder_delivery_mode, now);
    return "skipped";
  }

  const notificationId = await createNotification({
    body: job.body,
    linkPath: job.link_path,
    metadata: {
      ...sanitizeMetadata(job.metadata || {}),
      reminderType: job.reminder_type,
    },
    title: job.title,
    type: buildNotificationTypeForReminder(job.reminder_type),
    userId: job.user_id,
  });

  if (!notificationId) {
    await markReminderJobFailed(job, "Failed to create reminder notification.", now);
    return "failed";
  }

  await insertReminderDelivery({
    dedupeKey: job.dedupe_key,
    deliveryMode: job.delivery_mode_snapshot,
    job,
    notificationId,
    payload: {
      metadata: sanitizeMetadata(job.metadata || {}),
      reminderType: job.reminder_type,
    },
    status: "sent",
  });
  await markReminderJobSent(job.id, now);
  return "sent";
}

async function processDailyDigestReminderJobs(
  jobs: ReminderJobRow[],
  preferences: ReminderPreferenceSettings,
  now: Date
): Promise<{ failed: number; sent: number; skipped: number }> {
  const stats = { failed: 0, sent: 0, skipped: 0 };

  if (preferences.reminder_delivery_mode !== "daily_digest") {
    for (const job of jobs) {
      await rescheduleReminderJobForMode(job, preferences.reminder_delivery_mode, now);
      stats.skipped += 1;
    }
    return stats;
  }

  const enabledJobs: ReminderJobRow[] = [];

  for (const job of jobs) {
    if (!isReminderEnabled(preferences, job.reminder_type)) {
      await insertReminderDelivery({
        dedupeKey: job.dedupe_key,
        deliveryMode: "daily_digest",
        job,
        payload: { reason: "disabled_by_preference" },
        status: "skipped",
      });
      await markReminderJobSkipped(job.id, "Reminder disabled by preference.", now);
      stats.skipped += 1;
      continue;
    }

    enabledJobs.push(job);
  }

  if (enabledJobs.length === 0) {
    return stats;
  }

  const notificationId = await createNotification(
    buildDailyDigestNotificationInput(enabledJobs)
  );

  if (!notificationId) {
    for (const job of enabledJobs) {
      await markReminderJobFailed(job, "Failed to create daily digest notification.", now);
      stats.failed += 1;
    }
    return stats;
  }

  for (const job of enabledJobs) {
    await insertReminderDelivery({
      dedupeKey: job.dedupe_key,
      deliveryMode: "daily_digest",
      job,
      notificationId,
      payload: {
        digestDate: getManilaDateString(now),
        jobCount: enabledJobs.length,
        metadata: sanitizeMetadata(job.metadata || {}),
      },
      status: "sent",
    });
    await markReminderJobSent(job.id, now);
    stats.sent += 1;
  }

  return stats;
}

async function processDueReminderJobs(now: Date): Promise<ReminderSyncStats["processed"]> {
  const { data, error } = await supabaseAdmin
    .from("reminder_jobs")
    .select(
      "id, user_id, reminder_type, group_id, dedupe_key, title, body, link_path, metadata, candidate_due_at, due_at, next_attempt_at, delivery_mode_snapshot, attempt_count, status"
    )
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", now.toISOString())
    .order("due_at", { ascending: true })
    .limit(250);

  if (error) {
    await recordServerFailure({
      errorMessage: error.message,
      eventType: "notifications.reminders.process.load_due_jobs",
      resourceType: "reminder_job",
    });
    return { failed: 0, sent: 0, skipped: 0 };
  }

  const dueJobs = (data || []) as ReminderJobRow[];
  if (dueJobs.length === 0) {
    return { failed: 0, sent: 0, skipped: 0 };
  }

  const preferenceMap = await loadReminderPreferencesMap(dueJobs.map((job) => job.user_id));
  const claimedJobs: ReminderJobRow[] = [];

  for (const job of dueJobs) {
    const claimedJob = await claimReminderJob(job, now);
    if (claimedJob) {
      claimedJobs.push(claimedJob);
    }
  }

  const digestJobsByUser = new Map<string, ReminderJobRow[]>();
  const stats = { failed: 0, sent: 0, skipped: 0 };

  for (const job of claimedJobs) {
    const preferences = preferenceMap.get(job.user_id) || getDefaultReminderPreferences();

    if (job.delivery_mode_snapshot === "daily_digest") {
      const currentJobs = digestJobsByUser.get(job.user_id) || [];
      currentJobs.push(job);
      digestJobsByUser.set(job.user_id, currentJobs);
      continue;
    }

    const result = await processImmediateReminderJob(job, preferences, now);
    stats[result] += 1;
  }

  for (const [userId, jobs] of digestJobsByUser.entries()) {
    const preferences = preferenceMap.get(userId) || getDefaultReminderPreferences();
    const digestStats = await processDailyDigestReminderJobs(jobs, preferences, now);
    stats.failed += digestStats.failed;
    stats.sent += digestStats.sent;
    stats.skipped += digestStats.skipped;
  }

  return stats;
}

export async function reschedulePendingReminderJobsForUser(userId: string): Promise<void> {
  const preferences = await getReminderPreferencesForUser(userId);
  const now = new Date();
  const { data, error } = await supabaseAdmin
    .from("reminder_jobs")
    .select(
      "id, user_id, reminder_type, group_id, dedupe_key, title, body, link_path, metadata, candidate_due_at, due_at, next_attempt_at, delivery_mode_snapshot, attempt_count, status"
    )
    .eq("user_id", userId)
    .in("status", ["pending", "failed"]);

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "notifications.reminders.reschedule.load",
      resourceId: userId,
      resourceType: "reminder_job",
    });
    return;
  }

  for (const job of (data || []) as ReminderJobRow[]) {
    if (!isReminderEnabled(preferences, job.reminder_type)) {
      await markReminderJobSkipped(job.id, "Reminder disabled by preference update.", now);
      continue;
    }

    await rescheduleReminderJobForMode(job, preferences.reminder_delivery_mode, now);
  }
}

export async function syncAndProcessReminderJobs(now: Date = new Date()): Promise<ReminderSyncStats> {
  const enqueued = {
    eventTomorrow: await enqueueEventTomorrowReminderJobs(now),
    postDraw: await enqueuePostDrawReminderJobs(now),
    wishlistIncomplete: await enqueueWishlistIncompleteReminderJobs(now),
  };
  const processed = await processDueReminderJobs(now);

  return { enqueued, processed };
}
