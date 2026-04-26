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

function getMemberInitial(member: Member, index: number, anonymous: boolean, fallbackPrefix = "Member") {
  return getVisibleGroupMemberName(member, index, anonymous, fallbackPrefix)[0]?.toUpperCase();
}

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
  return (
    <>
      {isOwner && !drawDone && <InviteForm groupId={groupId} />}

      <div
        className="flex items-center gap-1.5 mb-2.5"
        style={{
          fontFamily: "'Fredoka', sans-serif",
          fontSize: "16px",
          fontWeight: 700,
          color: "#15803d",
        }}
      >
        {"\uD83C\uDF84"} Members
      </div>

      {acceptedMembers.length === 0 ? (
        <p className="text-gray-500 text-center text-sm mb-4">No accepted members yet.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {acceptedMembers.map((member, index) => {
            const isCurrentUser = currentUserId === member.user_id;
            const memberName = getVisibleGroupMemberName(
              member,
              index,
              requireAnonymousNickname
            );

            return (
              <div
                key={member.id}
                className="rounded-xl p-3 transition hover:-translate-y-0.5"
                style={{
                  background: "rgba(255,255,255,.6)",
                  border: "1px solid rgba(255,255,255,.85)",
                  borderLeft: `4px solid ${isCurrentUser ? "#f59e0b" : "#22c55e"}`,
                }}
              >
                {isCurrentUser ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                          style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                        >
                          {getMemberInitial(member, index, requireAnonymousNickname, "You")}
                        </div>
                        <div className="text-sm font-bold text-gray-800">You</div>
                      </div>

                      <span
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded-full text-white"
                        style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                      >
                        You {"\u2713"}
                      </span>
                    </div>

                    {!drawDone && (
                      <NicknameForm groupId={groupId} currentNickname={member.nickname || ""} />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                        style={{ background: "linear-gradient(135deg,#4ade80,#22c55e)" }}
                      >
                        {memberName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800">{memberName}</div>
                        <div className="text-[11px] text-gray-500 font-semibold">Joined</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOwner && !drawDone && member.user_id && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(member)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
                          style={{
                            background: "rgba(220,38,38,.06)",
                            color: "#ef4444",
                            border: "1px solid rgba(220,38,38,.12)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {"\u2715"} Remove
                        </button>
                      )}

                      <span
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded-full"
                        style={{ background: "#dcfce7", color: "#15803d" }}
                      >
                        Accepted {"\u2713"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pendingMembers.length > 0 && (
        <>
          <div
            className="flex items-center gap-1.5 mb-2.5"
            style={{
              fontFamily: "'Fredoka', sans-serif",
              fontSize: "16px",
              fontWeight: 700,
              color: "#92400e",
            }}
          >
            {"\u23F3"} Waiting for Response
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {pendingMembers.map((member, index) => (
              <div
                key={member.id}
                className="rounded-xl p-3 flex items-center justify-between"
                style={{
                  background: "rgba(255,255,255,.6)",
                  border: "1px solid rgba(255,255,255,.85)",
                  borderLeft: "4px solid #fbbf24",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg,#d1d5db,#9ca3af)" }}
                  >
                    ?
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">
                      {getVisibleGroupMemberName(member, index, requireAnonymousNickname)}
                    </div>
                    <div className="text-[11px] text-gray-500 font-semibold">
                      Hasn&apos;t responded yet
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isOwner && !drawDone && (
                    <RevokeInviteButton
                      groupId={groupId}
                      membershipId={member.id}
                      onRevoked={() => onRevokeMembership(member.id)}
                    />
                  )}

                  <span
                    className="text-[10px] font-extrabold px-2.5 py-1 rounded-full"
                    style={{ background: "#fef3c7", color: "#92400e" }}
                  >
                    Pending
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isOwner && !drawDone && declinedMembers.length > 0 && (
        <>
          <div
            className="flex items-center gap-1.5 mb-2.5"
            style={{
              fontFamily: "'Fredoka', sans-serif",
              fontSize: "16px",
              fontWeight: 700,
              color: "#dc2626",
            }}
          >
            {"\u274C"} Declined
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {declinedMembers.map((member, index) => (
              <div
                key={member.id}
                className="rounded-xl p-3 flex items-center justify-between"
                style={{
                  background: "rgba(255,255,255,.6)",
                  border: "1px solid rgba(255,255,255,.85)",
                  borderLeft: "4px solid #ef4444",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg,#f87171,#ef4444)" }}
                  >
                    {"\u2717"}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">
                      {getVisibleGroupMemberName(member, index, requireAnonymousNickname)}
                    </div>
                    <div className="text-[11px] text-gray-500 font-semibold">
                      Declined the invitation
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ResendButton groupId={groupId} memberEmail={member.email || ""} />
                  <RevokeInviteButton
                    groupId={groupId}
                    membershipId={member.id}
                    onRevoked={() => onRevokeMembership(member.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!drawDone && pendingMembers.length > 0 && isOwner && (
        <div
          className="rounded-xl p-3.5 flex items-start gap-2 text-xs leading-relaxed"
          style={{
            background: "rgba(59,130,246,.04)",
            border: "1px solid rgba(59,130,246,.1)",
            color: "#4a6fa5",
          }}
        >
          <span className="text-base">{"\uD83D\uDCA1"}</span>
          <div>
            <strong className="text-blue-700">Pending members</strong> need to log in and
            accept from their dashboard.{" "}
            <strong className="text-blue-700">Declined members</strong> can be re-invited
            with the Resend button.
          </div>
        </div>
      )}
    </>
  );
}
