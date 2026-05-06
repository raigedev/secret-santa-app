import InviteForm from "./InviteForm";
import NicknameForm from "./NicknameForm";
import ResendButton from "./ResendButton";
import RevokeInviteButton from "./RevokeInviteButton";
import { getVisibleGroupMemberName, type Member } from "./group-page-state";

type GroupMembersSectionProps = {
  acceptedMembers: Member[];
  currentUserId: string | null;
  declinedMembers: Member[];
  drawDone: boolean;
  groupId: string;
  isOwner: boolean;
  missingWishlistMemberNames?: string[];
  pendingMembers: Member[];
  requireAnonymousNickname: boolean;
  onRemoveMember: (member: Member) => void;
  onRevokeMembership: (membershipId: string) => void;
};

type MemberDisplayRow = {
  index: number;
  member: Member;
  status: "accepted" | "pending" | "declined";
};

const MEMBER_GRID_COLUMNS_CLASS =
  "lg:grid-cols-[minmax(220px,1.45fr)_minmax(128px,0.75fr)_minmax(150px,0.9fr)]";

export function GroupMembersSection({
  acceptedMembers,
  currentUserId,
  declinedMembers,
  drawDone,
  groupId,
  isOwner,
  missingWishlistMemberNames = [],
  pendingMembers,
  requireAnonymousNickname,
  onRemoveMember,
  onRevokeMembership,
}: GroupMembersSectionProps) {
  const missingWishlistNames = new Set(
    missingWishlistMemberNames.map((name) => normalizeMemberName(name))
  );
  const visibleDeclinedMembers = isOwner ? declinedMembers : [];
  const rows: MemberDisplayRow[] = [
    ...acceptedMembers.map((member, index) => ({
      index,
      member,
      status: "accepted" as const,
    })),
    ...pendingMembers.map((member, index) => ({
      index,
      member,
      status: "pending" as const,
    })),
    ...visibleDeclinedMembers.map((member, index) => ({
      index,
      member,
      status: "declined" as const,
    })),
  ];

  return (
    <section
      id="group-members"
      className="rounded-3xl bg-[#fffefa] p-4 shadow-[0_18px_44px_rgba(46,52,50,.06)] ring-1 ring-[rgba(72,102,78,.12)] sm:p-5"
      aria-label="Members"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MembersIcon />
            <h2 className="text-[18px] font-black text-[#2e3432]">
              Members ({rows.length})
            </h2>
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#64748b]">
            Monitor participation and progress.
          </p>
        </div>
        {isOwner && !drawDone && (
          <a
            href="#member-management"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-black text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,.14)] transition hover:-translate-y-0.5"
          >
            <MembersIcon />
            Open member list
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-[#f8faf7] px-4 py-5 text-center text-sm font-semibold text-[#64748b]">
          No members yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-[inset_0_0_0_1px_rgba(72,102,78,.1)]">
          <div
            className={`hidden gap-3 bg-[#fffefa] px-4 py-3 text-[11px] font-black text-[#5b605e] lg:grid ${MEMBER_GRID_COLUMNS_CLASS}`}
          >
            <span>Member</span>
            <span>Status</span>
            <span>Wishlist</span>
          </div>
          <div className="divide-y divide-[rgba(72,102,78,.1)]">
            {rows.map(({ member, status, index }) => {
              const isCurrentUser = currentUserId === member.user_id;
              const rawMemberName = getVisibleGroupMemberName(
                member,
                index,
                requireAnonymousNickname
              );
              const memberName = rawMemberName;
              const isWishlistMissing =
                status !== "accepted" || missingWishlistNames.has(normalizeMemberName(rawMemberName));
              const statusMeta = getStatusMeta(status, isWishlistMissing);
              const wishlistMeta = getWishlistMeta(status, isWishlistMissing);
              const canEditNickname = isCurrentUser && !drawDone;
              const canRemoveAcceptedMember =
                isOwner && !drawDone && status === "accepted" && Boolean(member.user_id) && !isCurrentUser;
              const canRevokePendingInvite = isOwner && !drawDone && status === "pending";
              const canManageDeclinedInvite = isOwner && !drawDone && status === "declined";
              const hasRowActions =
                canEditNickname || canRemoveAcceptedMember || canManageDeclinedInvite;

              return (
                <div
                  key={member.id}
                  className={`grid gap-3 px-4 py-3 lg:items-start ${MEMBER_GRID_COLUMNS_CLASS}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberFaceAvatar seed={index} status={status} />
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p
                          className="max-w-full whitespace-normal break-words text-sm font-black leading-5 text-[#2e3432]"
                          title={memberName}
                        >
                          {memberName}
                        </p>
                        {isCurrentUser && (
                          <span className="rounded-full bg-[#d7fadb] px-2 py-0.5 text-[10px] font-black text-[#48664e]">
                            You
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-[#64748b]">
                        {statusMeta.helper}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <span
                      className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black"
                      style={{ background: statusMeta.badgeBg, color: statusMeta.badgeColor }}
                    >
                      <StatusCheckIcon />
                      {statusMeta.label}
                    </span>
                    {canRevokePendingInvite && (
                      <div className="mt-2">
                        <RevokeInviteButton
                          groupId={groupId}
                          membershipId={member.id}
                          onRevoked={() => onRevokeMembership(member.id)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-[#64748b]">
                    <div className="flex items-center gap-1.5 font-black" style={{ color: wishlistMeta.color }}>
                      <SmallStatusIcon tone={wishlistMeta.color} />
                      {wishlistMeta.label}
                    </div>
                    <div className="mt-0.5">{wishlistMeta.helper}</div>
                  </div>

                  {hasRowActions && (
                    <div className="flex min-w-0 flex-wrap justify-start gap-2 border-t border-[rgba(72,102,78,.08)] pt-3 lg:col-span-3">
                      {canEditNickname && (
                        <NicknameForm groupId={groupId} currentNickname={member.nickname || ""} />
                      )}
                      {canRemoveAcceptedMember && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(member)}
                          className="rounded-full bg-[#fff7f6] px-3 py-1.5 text-[11px] font-black text-[#a43c3f]"
                        >
                          Remove
                        </button>
                      )}
                      {canManageDeclinedInvite && (
                        <>
                          <ResendButton groupId={groupId} memberEmail={member.email || ""} />
                          <RevokeInviteButton
                            groupId={groupId}
                            membershipId={member.id}
                            onRevoked={() => onRevokeMembership(member.id)}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isOwner && !drawDone && (
        <div id="member-management" className="mt-4">
          <InviteForm groupId={groupId} />
        </div>
      )}

      {!drawDone && (pendingMembers.length > 0 || declinedMembers.length > 0) && isOwner && (
        <div className="mt-4 rounded-2xl bg-[#eef3ef] px-4 py-3 text-xs font-bold leading-5 text-[#48664e]">
          Pending members need to accept from their dashboard. Declined invites can be resent by the organizer.
        </div>
      )}
    </section>
  );
}

function normalizeMemberName(name: string): string {
  return name.trim().toLowerCase();
}

function getStatusMeta(status: MemberDisplayRow["status"], isWishlistMissing: boolean) {
  if (status === "accepted") {
    if (isWishlistMissing) {
      return {
        badgeBg: "#fff7f6",
        badgeColor: "#a43c3f",
        helper: "Needs wishlist",
        label: "Needs attention",
      };
    }

    return {
      badgeBg: "#d7fadb",
      badgeColor: "#48664e",
      helper: "Joined",
      label: "All set",
    };
  }

  if (status === "pending") {
    return {
      badgeBg: "#fff4df",
      badgeColor: "#7b5902",
      helper: "Has not responded yet",
      label: "Pending",
    };
  }

  return {
    badgeBg: "#fff7f6",
    badgeColor: "#a43c3f",
    helper: "Declined the invitation",
    label: "Needs attention",
  };
}

function getWishlistMeta(status: MemberDisplayRow["status"], isWishlistMissing: boolean) {
  if (isWishlistMissing) {
    return {
      color: "#a43c3f",
      helper: status === "accepted" ? "No wishlist" : "Not started",
      label: "Missing",
    };
  }

  return {
    color: "#48664e",
    helper: "Wishlist ready",
    label: "Updated",
  };
}

function MembersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#48664e]" fill="none" aria-hidden="true">
      <path
        d="M8.4 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM15.8 10.4a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM3.6 18.8c.6-3.3 2.4-5 5-5s4.4 1.7 5 5M12.8 14.2c.8-.7 1.8-1.1 3-1.1 2.4 0 4 1.5 4.6 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MemberFaceAvatar({
  seed,
  status,
}: {
  seed: number;
  status: MemberDisplayRow["status"];
}) {
  const palette = [
    { hair: "#a43c3f", skin: "#ffd7bc", bg: "#f7e8e1" },
    { hair: "#f0a65a", skin: "#ffd9b0", bg: "#fff4df" },
    { hair: "#48664e", skin: "#c78964", bg: "#e7f1e7" },
    { hair: "#6d5a9c", skin: "#f2c2a0", bg: "#efeaf8" },
    { hair: "#5f3b28", skin: "#d89b72", bg: "#f2ece6" },
  ];
  const colors = palette[seed % palette.length];
  const muted = status !== "accepted";

  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
      style={{ background: muted ? "#eef1ee" : colors.bg }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="h-9 w-9">
        <circle cx="20" cy="20" r="18" fill={muted ? "#dfe4e1" : colors.bg} />
        <circle cx="20" cy="20" r="11" fill={muted ? "#f3f4f2" : colors.skin} />
        <path
          d="M10 19c1.4-7 5.5-10.5 10.4-10.5 4.3 0 8.2 2.7 9.6 8.2-5-2.5-10.9-2.3-20 .3Z"
          fill={muted ? "#aeb3b1" : colors.hair}
        />
        <circle cx="16.2" cy="20.8" r="1.5" fill="#2e3432" />
        <circle cx="23.8" cy="20.8" r="1.5" fill="#2e3432" />
        <path
          d="M15.8 26c2.6 1.9 5.6 1.9 8.4 0"
          fill="none"
          stroke="#48664e"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

function StatusCheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="m3.5 8 2.8 2.8 6.2-6.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SmallStatusIcon({ tone }: { tone: string }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" stroke={tone} strokeWidth="1.6" />
      <path
        d="m5.8 8.2 1.5 1.5 3.2-3.3"
        stroke={tone}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
