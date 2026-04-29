import Link from "next/link";
import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { getEmailVerificationMessage, isUserEmailVerified } from "@/lib/auth/user-status";
import { sanitizeGroupNickname, validateAnonymousGroupNickname } from "@/lib/groups/nickname";
import {
  countActiveGroupSlots,
  getGroupCapacityMessage,
  MAX_GROUP_MEMBERS,
} from "@/lib/groups/capacity";
import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { createNotification } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type InvitePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

type InvitePreview = {
  groupId: string;
  name: string;
  description: string | null;
  eventDate: string;
  memberCount: number;
  requireAnonymousNickname: boolean;
  isValid: boolean;
  isClosed: boolean;
  membershipStatus: "accepted" | "pending" | "declined" | null;
  message: string;
};

type InvitePreviewGroup = {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  require_anonymous_nickname: boolean | null;
};

function normalizeToken(token: string): string {
  return token.trim();
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(normalizeToken(token)).digest("hex");
}

function buildGroupInvitePreview({
  group,
  isClosed,
  memberCount,
  message,
  membershipStatus,
}: {
  group: InvitePreviewGroup;
  isClosed: boolean;
  memberCount: number | null;
  message: string;
  membershipStatus: InvitePreview["membershipStatus"];
}): InvitePreview {
  return {
    groupId: group.id,
    name: group.name,
    description: group.description,
    eventDate: group.event_date || "",
    memberCount: memberCount || 0,
    requireAnonymousNickname: Boolean(group.require_anonymous_nickname),
    isValid: true,
    isClosed,
    membershipStatus,
    message,
  };
}

async function loadInvitePreview(
  token: string,
  user: { id: string; email?: string | null } | null
): Promise<InvitePreview> {
  const normalizedToken = normalizeToken(token);
  const tokenHash = hashInviteToken(normalizedToken);

  const { data: link, error: linkError } = await supabaseAdmin
    .from("group_invite_links")
    .select("group_id, is_active, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) {
    await recordServerFailure({
      actorUserId: user?.id || null,
      errorMessage: linkError.message,
      eventType: "invite.preview.lookup_link",
      resourceType: "group_invite_link",
    });
  }

  if (!link || !link.is_active) {
    return {
      groupId: "",
      name: "Invite unavailable",
      description: null,
      eventDate: "",
      memberCount: 0,
      requireAnonymousNickname: false,
      isValid: false,
      isClosed: true,
      membershipStatus: null,
      message: "This invite link is no longer valid.",
    };
  }

  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return {
      groupId: link.group_id,
      name: "Invite expired",
      description: null,
      eventDate: "",
      memberCount: 0,
      requireAnonymousNickname: false,
      isValid: false,
      isClosed: true,
      membershipStatus: null,
      message: "This invite link has expired. Ask the group organizer for a new one.",
    };
  }

  const [{ data: group }, { data: drawRows }, { count: memberCount }, membershipsResult] =
    await Promise.all([
      supabaseAdmin
        .from("groups")
        .select("id, name, description, event_date, owner_id, require_anonymous_nickname")
        .eq("id", link.group_id)
        .maybeSingle(),
      supabaseAdmin
        .from("assignments")
        .select("id")
        .eq("group_id", link.group_id)
        .limit(1),
      supabaseAdmin
        .from("group_members")
        .select("id", { count: "exact", head: true })
        .eq("group_id", link.group_id),
      supabaseAdmin
        .from("group_members")
        .select("status, user_id, email")
        .eq("group_id", link.group_id)
        .limit(50),
    ]);

  if (!group) {
    return {
      groupId: link.group_id,
      name: "Invite unavailable",
      description: null,
      eventDate: "",
      memberCount: memberCount || 0,
      requireAnonymousNickname: false,
      isValid: false,
      isClosed: true,
      membershipStatus: null,
      message: "This group could not be loaded.",
    };
  }

  if (membershipsResult.error) {
    await recordServerFailure({
      actorUserId: user?.id || null,
      errorMessage: membershipsResult.error.message,
      eventType: "invite.preview.lookup_memberships",
      resourceId: link.group_id,
      resourceType: "group_membership",
    });
  }

  const hasDrawStarted = Boolean(drawRows && drawRows.length > 0);
  const normalizedEmail = (user?.email || "").toLowerCase();
  const activeMembershipCount = (membershipsResult.data || []).filter(
    (membership) => membership.status === "accepted" || membership.status === "pending"
  ).length;
  const matchingMembership =
    membershipsResult.data?.find(
      (membership) =>
        membership.user_id === user?.id ||
        (!membership.user_id && membership.email === normalizedEmail) ||
        membership.email === normalizedEmail
    ) || null;

  if (hasDrawStarted) {
    return buildGroupInvitePreview({
      group,
      isClosed: true,
      memberCount,
      membershipStatus: matchingMembership?.status || null,
      message: "This group has already drawn names, so new joins are closed.",
    });
  }

  if (
    activeMembershipCount >= MAX_GROUP_MEMBERS &&
    matchingMembership?.status !== "accepted" &&
    matchingMembership?.status !== "pending"
  ) {
    return buildGroupInvitePreview({
      group,
      isClosed: true,
      memberCount,
      membershipStatus: matchingMembership?.status || null,
      message: getGroupCapacityMessage(),
    });
  }

  return buildGroupInvitePreview({
    group,
    isClosed: false,
    memberCount,
    membershipStatus: matchingMembership?.status || null,
    message: matchingMembership?.status === "accepted" ? "You're already in this group." : "",
  });
}

async function joinGroupViaInviteToken(
  token: string,
  nickname?: string
): Promise<{ success: boolean; message: string; groupId?: string }> {
  const normalizedToken = normalizeToken(token);
  const tokenHash = hashInviteToken(normalizedToken);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return { success: false, message: "You must be logged in to join a group." };
  }

  if (!isUserEmailVerified(user)) {
    return { success: false, message: getEmailVerificationMessage() };
  }

  const { data: link } = await supabaseAdmin
    .from("group_invite_links")
    .select("id, group_id, is_active, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link || !link.is_active) {
    return { success: false, message: "This invite link is no longer valid." };
  }

  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return { success: false, message: "This invite link has expired. Ask the group organizer for a new one." };
  }

  const rateLimit = await enforceRateLimit({
    action: "invite.join_group",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: link.group_id,
    resourceType: "group_membership",
    subject: `${user.id}:${link.group_id}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: existingDraw } = await supabaseAdmin
    .from("assignments")
    .select("id")
    .eq("group_id", link.group_id)
    .limit(1);

  if (existingDraw && existingDraw.length > 0) {
    return {
      success: false,
      message: "This group has already drawn names, so new joins are closed.",
    };
  }

  const normalizedEmail = user.email.toLowerCase();
  const { data: groupSettings } = await supabaseAdmin
    .from("groups")
    .select("name, owner_id, require_anonymous_nickname")
    .eq("id", link.group_id)
    .maybeSingle();

  if (!groupSettings) {
    return { success: false, message: "This group could not be loaded." };
  }

  const requiresAnonymousNickname = Boolean(groupSettings.require_anonymous_nickname);
  const cleanNickname = sanitizeGroupNickname(nickname || "");

  if (requiresAnonymousNickname) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const nicknameMessage = validateAnonymousGroupNickname({
      nickname: cleanNickname,
      displayName: profile?.display_name || null,
      email: normalizedEmail,
    });

    if (nicknameMessage) {
      return { success: false, message: nicknameMessage };
    }
  }

  const defaultNickname = normalizedEmail.split("@")[0] || "member";

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("group_members")
    .select("id, status, user_id, email, nickname")
    .eq("group_id", link.group_id)
    .limit(50);

  if (membershipsError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membershipsError.message,
      eventType: "invite.join_group.lookup_memberships",
      resourceId: link.group_id,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to join the group. Please try again." };
  }

  const matchingMemberships = (memberships || []).filter(
    (membership) =>
      membership.user_id === user.id ||
      membership.email === normalizedEmail
  );

  const acceptedMembership = matchingMemberships.find(
    (membership) => membership.status === "accepted"
  );

  if (acceptedMembership) {
    return {
      success: true,
      message: "You're already in this group.",
      groupId: link.group_id,
    };
  }

  const reusableMembership =
    matchingMemberships.find((membership) => membership.status === "pending") ||
    matchingMemberships.find((membership) => membership.status === "declined") ||
    null;

  if (!reusableMembership || reusableMembership.status === "declined") {
    try {
      const activeSlotCount = await countActiveGroupSlots(link.group_id);
      if (activeSlotCount >= MAX_GROUP_MEMBERS) {
        return { success: false, message: getGroupCapacityMessage() };
      }
    } catch (capacityError) {
      await recordServerFailure({
        actorUserId: user.id,
        errorMessage:
          capacityError instanceof Error ? capacityError.message : "Unknown capacity error",
        eventType: "invite.join_group.capacity_check",
        resourceId: link.group_id,
        resourceType: "group_membership",
      });

      return { success: false, message: "Failed to check the current group capacity." };
    }
  }

  if (reusableMembership) {
    const { error: updateError } = await supabaseAdmin
      .from("group_members")
      .update({
        user_id: user.id,
        email: normalizedEmail,
        nickname: requiresAnonymousNickname
          ? cleanNickname
          : reusableMembership.nickname || defaultNickname,
        status: "accepted",
      })
      .eq("id", reusableMembership.id);

    if (updateError) {
      await recordServerFailure({
        actorUserId: user.id,
        errorMessage: updateError.message,
        eventType: "invite.join_group.update_membership",
        resourceId: link.group_id,
        resourceType: "group_membership",
      });

      return { success: false, message: "Failed to join the group. Please try again." };
    }

    const duplicateIds = matchingMemberships
      .filter((membership) => membership.id !== reusableMembership.id)
      .map((membership) => membership.id);

    if (duplicateIds.length > 0) {
      await supabaseAdmin.from("group_members").delete().in("id", duplicateIds);
    }
  } else {
    const { error: insertError } = await supabaseAdmin.from("group_members").insert({
      group_id: link.group_id,
      user_id: user.id,
      email: normalizedEmail,
      nickname: requiresAnonymousNickname ? cleanNickname : defaultNickname,
      role: "member",
      status: "accepted",
    });

    if (insertError) {
      await recordServerFailure({
        actorUserId: user.id,
        errorMessage: insertError.message,
        eventType: "invite.join_group.insert_membership",
        resourceId: link.group_id,
        resourceType: "group_membership",
      });

      return { success: false, message: "Failed to join the group. Please try again." };
    }
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { joinMethod: "invite_link" },
    eventType: "invite.join_group",
    outcome: "success",
    resourceId: link.group_id,
    resourceType: "group",
  });

  if (groupSettings.owner_id !== user.id) {
    await createNotification({
      userId: groupSettings.owner_id,
      type: "invite",
      title: "Someone joined through your invite link",
      body: `A new member joined ${groupSettings.name} using the shared invite link.`,
      linkPath: `/group/${link.group_id}`,
      metadata: {
        groupId: link.group_id,
        joinMethod: "invite_link",
      },
      preferenceKey: "notify_invites",
    });
  }

  return {
    success: true,
    message: "Joined group!",
    groupId: link.group_id,
  };
}

export default async function InviteLinkPage({
  params,
  searchParams,
}: InvitePageProps) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const preview = await loadInvitePreview(token, user);
  const nextPath = `/invite/${encodeURIComponent(token)}`;
  const authNext = encodeURIComponent(nextPath);
  const needsEmailConfirmation = Boolean(user && !isUserEmailVerified(user));
  const errorMessage = resolvedSearchParams.error
    ? decodeURIComponent(resolvedSearchParams.error)
    : null;

  async function handleJoinInvite(formData: FormData) {
    "use server";

    const nickname = (formData.get("nickname") as string | null) || "";
    const result = await joinGroupViaInviteToken(token, nickname);

    if (result.success && result.groupId) {
      redirect(`/group/${result.groupId}`);
    }

    redirect(`${nextPath}?error=${encodeURIComponent(result.message)}`);
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: "linear-gradient(180deg,#f5f9ff 0%,#e6eef9 45%,#dce8f5 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div
        className="w-full max-w-[640px] rounded-[28px] overflow-hidden"
        style={{
          background: "linear-gradient(180deg,#fffdf7,#fff8ef)",
          border: "2px solid rgba(22,101,52,.12)",
          boxShadow: "0 24px 60px rgba(15,23,42,.12)",
        }}
      >
        <div
          className="px-5 py-5 text-white sm:px-6"
          style={{ background: "linear-gradient(135deg,#14532d,#166534)" }}
        >
          <div className="text-[30px] font-bold" style={{ fontFamily: "'Fredoka', sans-serif" }}>
            🎁 Join Secret Santa group
          </div>
          <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,.82)" }}>
            Join before names are drawn. For safety, invite links expire after 7 days.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div
            className="rounded-[20px] p-5 mb-4"
            style={{ background: "rgba(255,255,255,.78)", border: "1px solid rgba(22,101,52,.08)" }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-700 mb-2">
              Group Preview
            </div>
            <div
              className="text-[26px] font-bold"
              style={{ fontFamily: "'Fredoka', sans-serif", color: "#7f1d1d" }}
            >
              {preview.name}
            </div>
            {preview.description && (
              <p className="text-[14px] text-slate-600 leading-relaxed mt-2">
                {preview.description}
              </p>
            )}

            {preview.isValid && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(22,163,74,.06)", border: "1px solid rgba(22,163,74,.12)" }}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Gift date
                  </div>
                  <div className="text-[15px] font-bold text-slate-800">{preview.eventDate}</div>
                </div>
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.12)" }}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Members
                  </div>
                  <div className="text-[15px] font-bold text-slate-800">{preview.memberCount}</div>
                </div>
              </div>
            )}
          </div>

          {(errorMessage || preview.message) && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-[13px] font-semibold"
              style={{
                background:
                  errorMessage || preview.isClosed || !preview.isValid
                    ? "rgba(254,242,242,.88)"
                    : "rgba(240,253,244,.88)",
                color:
                  errorMessage || preview.isClosed || !preview.isValid ? "#b91c1c" : "#166534",
                border:
                  errorMessage || preview.isClosed || !preview.isValid
                    ? "1px solid rgba(220,38,38,.14)"
                    : "1px solid rgba(22,163,74,.14)",
              }}
            >
              {errorMessage || preview.message}
            </div>
          )}

          {!preview.isValid ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/dashboard"
                className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold text-white sm:w-auto"
                style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}
              >
                Go to Dashboard
              </Link>
            </div>
          ) : needsEmailConfirmation ? (
            <div className="space-y-3">
              <p className="text-[14px] text-slate-600 leading-relaxed">
                You&apos;re signed in as <strong>{user?.email || "your account"}</strong>, but
                you still need to confirm your email before joining this group.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href={`/login?next=${authNext}&error=confirm_email&message=${encodeURIComponent(
                    getEmailVerificationMessage()
                  )}`}
                  className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold text-white sm:w-auto"
                  style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}
                >
                  Confirm Email First
                </Link>
              </div>
            </div>
          ) : preview.membershipStatus === "accepted" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={`/group/${preview.groupId}`}
                className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold text-white sm:w-auto"
                style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}
              >
                Open Group
              </Link>
              <Link
                href="/dashboard"
                className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold sm:w-auto"
                style={{
                  background: "rgba(59,130,246,.08)",
                  color: "#1d4ed8",
                  border: "1px solid rgba(59,130,246,.14)",
                }}
              >
                Back to Dashboard
              </Link>
            </div>
          ) : preview.isClosed ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/dashboard"
                className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold text-white sm:w-auto"
                style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}
              >
                Go to Dashboard
              </Link>
            </div>
          ) : !user ? (
            <div className="space-y-3">
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Log in or create an account first, then we&apos;ll bring you right back here
                to join <strong>{preview.name}</strong>.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href={`/login?next=${authNext}`}
                  className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold text-white sm:w-auto"
                  style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}
                >
                  Log in to Join
                </Link>
                <Link
                  href={`/create-account?next=${authNext}`}
                  className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold sm:w-auto"
                  style={{
                    background: "rgba(34,197,94,.08)",
                    color: "#166534",
                    border: "1px solid rgba(22,163,74,.14)",
                  }}
                >
                  Create Account
                </Link>
              </div>
            </div>
          ) : (
            <form action={handleJoinInvite} className="space-y-3">
              <p className="text-[14px] text-slate-600 leading-relaxed">
                You&apos;re signed in as <strong>{user.email}</strong>. Join this group to
                start participating right away.
              </p>
              {preview.requireAnonymousNickname && (
                <div
                  className="rounded-xl border px-4 py-3"
                  style={{
                    background: "rgba(239,246,255,.9)",
                    borderColor: "rgba(59,130,246,.16)",
                  }}
                >
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky-700">
                    Choose a nickname for this group
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-600">
                    This host wants members to join with an event alias instead of using a real
                    name or email.
                  </p>
                  <input
                    type="text"
                    name="nickname"
                    maxLength={30}
                    placeholder="Choose a group nickname"
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none"
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold text-white sm:w-auto"
                style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}
              >
                {preview.membershipStatus === "declined"
                  ? "Join Again"
                  : preview.requireAnonymousNickname
                    ? "Join with Nickname"
                    : "Join Group"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
