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

export function GroupMembersSection({
  acceptedMembers,
  currentUserId,
  declinedMembers,
  drawDone,
  groupId,
  isOwner,
  pendingMembers,
  requireAnonymousNickname,
  onRemoveMember,
  onRevokeMembership,
}: GroupMembersSectionProps) {
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
    ...declinedMembers.map((member, index) => ({
      index,
      member,
      status: "declined" as const,
    })),
  ];

  return (
    <section
      className="rounded-[26px] bg-white p-4 shadow-[0_18px_44px_rgba(46,52,50,.06)] sm:p-5"
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
            href="#invite-members"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-black text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,.14)]"
          >
            Open member list
          </a>
        )}
      </div>

      {isOwner && !drawDone && (
        <div id="invite-members" className="mb-4">
          <InviteForm groupId={groupId} />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-[18px] bg-[#f8faf7] px-4 py-5 text-center text-sm font-semibold text-[#64748b]">
          No members yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[20px] shadow-[inset_0_0_0_1px_rgba(72,102,78,.1)]">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_0.8fr_0.8fr_0.8fr_auto] gap-3 bg-[#f8faf7] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#64748b] md:grid">
            <span>Member</span>
            <span>Status</span>
            <span>Wishlist</span>
            <span>Messages</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-[rgba(72,102,78,.1)]">
            {rows.map(({ member, status, index }) => {
              const isCurrentUser = currentUserId === member.user_id;
              const memberName = isCurrentUser
                ? "You"
                : getVisibleGroupMemberName(member, index, requireAnonymousNickname);
              const displayInitial = memberName[0]?.toUpperCase() || "M";
              const statusMeta = getStatusMeta(status);

              return (
                <div
                  key={member.id}
                  className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_0.8fr_0.8fr_0.8fr_auto] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black"
                      style={{ background: statusMeta.avatarBg, color: statusMeta.avatarColor }}
                      aria-hidden="true"
                    >
                      {displayInitial}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-[#2e3432]">
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

                  <span
                    className="w-fit rounded-full px-3 py-1 text-[11px] font-black"
                    style={{ background: statusMeta.badgeBg, color: statusMeta.badgeColor }}
                  >
                    {statusMeta.label}
                  </span>
                  <span className="text-xs font-semibold text-[#64748b]">
                    {status === "accepted" ? "Updated" : "Not started"}
                  </span>
                  <span className="text-xs font-semibold text-[#64748b]">
                    {status === "accepted" ? "Read" : "No recent messages"}
                  </span>
                  <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                    {isCurrentUser && !drawDone && (
                      <NicknameForm groupId={groupId} currentNickname={member.nickname || ""} />
                    )}
                    {isOwner && !drawDone && status === "accepted" && member.user_id && !isCurrentUser && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(member)}
                        className="rounded-full bg-[#fff7f6] px-3 py-1.5 text-[11px] font-black text-[#a43c3f]"
                      >
                        Remove
                      </button>
                    )}
                    {isOwner && !drawDone && status === "pending" && (
                      <RevokeInviteButton
                        groupId={groupId}
                        membershipId={member.id}
                        onRevoked={() => onRevokeMembership(member.id)}
                      />
                    )}
                    {isOwner && !drawDone && status === "declined" && (
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!drawDone && pendingMembers.length > 0 && isOwner && (
        <div className="mt-4 rounded-[18px] bg-[#eef3ef] px-4 py-3 text-xs font-bold leading-5 text-[#48664e]">
          Pending members need to log in and accept from their dashboard. Declined members can be re-invited.
        </div>
      )}
    </section>
  );
}

function getStatusMeta(status: MemberDisplayRow["status"]) {
  if (status === "accepted") {
    return {
      avatarBg: "#d7fadb",
      avatarColor: "#48664e",
      badgeBg: "#d7fadb",
      badgeColor: "#48664e",
      helper: "Joined",
      label: "All set",
    };
  }

  if (status === "pending") {
    return {
      avatarBg: "#fff4df",
      avatarColor: "#7b5902",
      badgeBg: "#fff4df",
      badgeColor: "#7b5902",
      helper: "Has not responded yet",
      label: "Pending",
    };
  }

  return {
    avatarBg: "#fff7f6",
    avatarColor: "#a43c3f",
    badgeBg: "#fff7f6",
    badgeColor: "#a43c3f",
    helper: "Declined the invitation",
    label: "Needs attention",
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
