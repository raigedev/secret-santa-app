import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isRecord, isUuid } from "@/lib/validation/common";

const MAX_GROUP_PROFILE_LOOKUPS = 50;
const PEER_PROFILE_RATE_LIMIT_MAX_REQUESTS = 120;
const PEER_PROFILE_RATE_LIMIT_WINDOW_SECONDS = 3600;
const PEER_PROFILE_SERVER_CACHE_TTL_MS = 5 * 60 * 1000;

type GroupAccessRow = {
  id: string;
  owner_id: string;
  require_anonymous_nickname: boolean | null;
};

type GroupMemberProfileRow = {
  email: string | null;
  group_id: string;
  user_id: string | null;
};

type ProfileRow = {
  avatar_emoji: string | null;
  avatar_url: string | null;
  display_name: string | null;
  user_id: string;
};

type PeerProfilePayload = {
  profilesByGroup: Record<string, ProfileRow[]>;
};

type PeerProfileCacheEntry = {
  createdAt: number;
  payload: PeerProfilePayload;
};

const peerProfileCache = new Map<string, PeerProfileCacheEntry>();

export const dynamic = "force-dynamic";

function peerProfileResponse(payload: PeerProfilePayload, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(payload, {
    ...init,
    headers,
  });
}

function parseGroupIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter(isUuid))).slice(0, MAX_GROUP_PROFILE_LOOKUPS);
}

function getPeerProfileCacheKey(userId: string, groupIds: string[]) {
  return `${userId}:${[...groupIds].sort().join(",")}`;
}

function readPeerProfileCache(cacheKey: string): PeerProfilePayload | null {
  const cached = peerProfileCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.createdAt > PEER_PROFILE_SERVER_CACHE_TTL_MS) {
    peerProfileCache.delete(cacheKey);
    return null;
  }

  return cached.payload;
}

function writePeerProfileCache(cacheKey: string, payload: PeerProfilePayload) {
  peerProfileCache.set(cacheKey, {
    createdAt: Date.now(),
    payload,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return peerProfileResponse({ profilesByGroup: {} }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return peerProfileResponse({ profilesByGroup: {} }, { status: 400 });
  }

  if (!isRecord(body)) {
    return peerProfileResponse({ profilesByGroup: {} }, { status: 400 });
  }

  const requestedGroupIds = parseGroupIds(body.groupIds);

  if (requestedGroupIds.length === 0) {
    return peerProfileResponse({ profilesByGroup: {} } satisfies PeerProfilePayload);
  }

  const cacheKey = getPeerProfileCacheKey(user.id, requestedGroupIds);
  const cachedPayload = readPeerProfileCache(cacheKey);

  if (cachedPayload) {
    return peerProfileResponse(cachedPayload);
  }

  const rateLimit = await enforceRateLimit({
    action: "groups.peer_profiles",
    actorUserId: user.id,
    maxAttempts: PEER_PROFILE_RATE_LIMIT_MAX_REQUESTS,
    resourceType: "group",
    subject: user.id,
    windowSeconds: PEER_PROFILE_RATE_LIMIT_WINDOW_SECONDS,
  });

  if (!rateLimit.allowed) {
    return peerProfileResponse(
      { profilesByGroup: {} },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)),
        },
      }
    );
  }

  const [{ data: groups, error: groupsError }, { data: members, error: membersError }] =
    await Promise.all([
      supabaseAdmin
        .from("groups")
        .select("id, owner_id, require_anonymous_nickname")
        .in("id", requestedGroupIds),
      supabaseAdmin
        .from("group_members")
        .select("group_id, user_id, email")
        .in("group_id", requestedGroupIds)
        .eq("status", "accepted"),
    ]);

  if (groupsError || membersError) {
    return peerProfileResponse({ profilesByGroup: {} }, { status: 500 });
  }

  const normalizedEmail = user.email?.trim().toLowerCase() || "";
  const groupById = new Map((groups || []).map((group) => [group.id, group as GroupAccessRow]));
  const accessibleGroupIds = new Set<string>();

  for (const group of groups || []) {
    if (group.owner_id === user.id) {
      accessibleGroupIds.add(group.id);
    }
  }

  for (const member of (members || []) as GroupMemberProfileRow[]) {
    const isCurrentUser =
      member.user_id === user.id ||
      (member.email ? member.email.trim().toLowerCase() === normalizedEmail : false);

    if (isCurrentUser) {
      accessibleGroupIds.add(member.group_id);
    }
  }

  if (accessibleGroupIds.size === 0) {
    const payload = { profilesByGroup: {} } satisfies PeerProfilePayload;
    writePeerProfileCache(cacheKey, payload);
    return peerProfileResponse(payload);
  }

  const memberRows = ((members || []) as GroupMemberProfileRow[]).filter(
    (member) => accessibleGroupIds.has(member.group_id) && member.user_id
  );
  const profileUserIds = Array.from(new Set(memberRows.map((member) => member.user_id).filter(isUuid)));

  if (profileUserIds.length === 0) {
    const payload = { profilesByGroup: {} } satisfies PeerProfilePayload;
    writePeerProfileCache(cacheKey, payload);
    return peerProfileResponse(payload);
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, avatar_emoji, avatar_url")
    .in("user_id", profileUserIds);

  if (profilesError) {
    return peerProfileResponse({ profilesByGroup: {} }, { status: 500 });
  }

  const profileByUserId = new Map((profiles || []).map((profile) => [profile.user_id, profile as ProfileRow]));
  const profilesByGroup: Record<string, ProfileRow[]> = {};

  for (const member of memberRows) {
    const userId = member.user_id;
    const profile = userId ? profileByUserId.get(userId) : null;

    if (!profile) {
      continue;
    }

    const group = groupById.get(member.group_id);
    const hideIdentity = Boolean(group?.require_anonymous_nickname);

    if (hideIdentity) {
      continue;
    }

    if (!profilesByGroup[member.group_id]) {
      profilesByGroup[member.group_id] = [];
    }

    profilesByGroup[member.group_id].push({
      user_id: profile.user_id,
      avatar_emoji: profile.avatar_emoji,
      avatar_url: hideIdentity ? null : profile.avatar_url,
      display_name: hideIdentity ? null : profile.display_name,
    });
  }

  const payload = { profilesByGroup } satisfies PeerProfilePayload;
  writePeerProfileCache(cacheKey, payload);

  return peerProfileResponse(payload);
}
