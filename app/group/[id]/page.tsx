import { createClient } from "@/lib/supabase/server";
import { deleteGroup } from "./actions";
import InviteForm from "./InviteForm";
import NicknameForm from "./NicknameForm";
import ResendButton from "./ResendButton";

// ─── Member type ───
type Member = {
  user_id: string | null;
  nickname: string | null;
  email: string | null;
  role: string;
  status: string; // "pending", "accepted", or "declined"
};

export default async function GroupDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id) {
    return <div>Invalid group ID</div>;
  }

  const supabase = await createClient();

  // ─── Get the logged-in user ───
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── Fetch group details ───
  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .select("name, description, event_date, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (groupError) {
    console.error("Error loading group:", groupError);
    return <div>Error loading group</div>;
  }

  if (!groupData) {
    return <div>Group not found</div>;
  }

  const isOwner = user?.id === groupData.owner_id;

  // ─── Fetch all members (including declined, so owner can resend) ───
  const { data: membersData, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, nickname, email, role, status")
    .eq("group_id", id);

  if (membersError) {
    console.error("Error loading members:", membersError);
    return <div>Error loading members</div>;
  }

  const allMembers: Member[] = (membersData ?? []) as Member[];

  // ─── Split members by status ───
  // Accepted = fully joined the group
  // Pending = invited but hasn't responded yet
  // Declined = said no (owner can resend)
  const acceptedMembers = allMembers.filter((m) => m.status === "accepted");
  const pendingMembers = allMembers.filter((m) => m.status === "pending");
  const declinedMembers = allMembers.filter((m) => m.status === "declined");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 via-white to-yellow-200 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 max-w-2xl w-full p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">

        {/* ─── Group Title ─── */}
        <h1 className="text-3xl font-bold text-yellow-700 drop-shadow-lg mb-2">
          🎁 {groupData.name}
        </h1>

        {groupData.description && (
          <p className="text-gray-600 mb-2">{groupData.description}</p>
        )}

        <p className="text-sm text-gray-500 mb-6">
          📅 Event Date: {groupData.event_date}
        </p>

        {/* ─── Status Summary ─── */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold">
            ✅ Accepted: {acceptedMembers.length}
          </div>
          <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg text-sm font-bold">
            ⏳ Pending: {pendingMembers.length}
          </div>
          {declinedMembers.length > 0 && (
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-bold">
              ❌ Declined: {declinedMembers.length}
            </div>
          )}
          <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold">
            👥 Total: {allMembers.length}
          </div>
        </div>

        {/* ─── Invite Form (owner only) ─── */}
        {isOwner && <InviteForm groupId={id} />}

        {/* ─── Delete Group (owner only) ─── */}
        {isOwner && (
          <form action={deleteGroup} className="mb-6">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition"
            >
              🗑️ Delete Group
            </button>
          </form>
        )}

        {/* ═══ ACCEPTED MEMBERS ═══ */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          🎄 Participants
        </h2>

        {acceptedMembers.length === 0 ? (
          <p className="text-gray-600 text-center mb-6">
            No accepted members yet.
          </p>
        ) : (
          <ul className="space-y-3 mb-6">
            {acceptedMembers.map((m, index) => {
              const isCurrentUser = user?.id === m.user_id;

              return (
                <li
                  key={m.user_id || index}
                  className="rounded-lg p-4 shadow-md font-semibold transition transform hover:scale-105 bg-gradient-to-r from-green-300 to-green-500 text-white"
                >
                  {isCurrentUser ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <span>🎁 You</span>
                        <span className="text-xs px-3 py-1 rounded-full font-bold bg-white/30 text-white">
                          Accepted ✓
                        </span>
                      </div>
                      <NicknameForm
                        groupId={id}
                        currentNickname={m.nickname || ""}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>
                        🎁 {m.nickname || `Participant ${index + 1}`}
                      </span>
                      <span className="text-xs px-3 py-1 rounded-full font-bold bg-white/30 text-white">
                        Accepted ✓
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* ═══ PENDING MEMBERS ═══ */}
        {pendingMembers.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-yellow-700 mb-3">
              ⏳ Waiting for Response
            </h2>
            <ul className="space-y-3 mb-6">
              {pendingMembers.map((m, index) => (
                <li
                  key={m.email || index}
                  className="rounded-lg p-4 shadow-md font-semibold bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600 flex items-center justify-between"
                >
                  <span>
                    ⏳ {m.nickname || `Participant ${index + 1}`}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full font-bold bg-yellow-400/30 text-yellow-800">
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* ═══ DECLINED MEMBERS (owner only) ═══ */}
        {/* Only the owner sees declined members with a resend button.
            Regular members don't need to know who declined. */}
        {isOwner && declinedMembers.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-red-600 mb-3">
              ❌ Declined
            </h2>
            <ul className="space-y-3 mb-6">
              {declinedMembers.map((m, index) => (
                <li
                  key={m.email || index}
                  className="rounded-lg p-4 shadow-md font-semibold bg-gradient-to-r from-red-100 to-red-200 text-red-700 flex items-center justify-between"
                >
                  <span>
                    {m.nickname || `Participant ${index + 1}`}
                  </span>
                  {/* Resend button — resets status to "pending" */}
                  <ResendButton
                    groupId={id}
                    memberEmail={m.email || ""}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* ─── Info box (owner only) ─── */}
        {pendingMembers.length > 0 && isOwner && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            💡 <strong>Pending members</strong> need to log in and accept the invitation
            from their dashboard. <strong>Declined members</strong> can be re-invited
            using the Resend button above.
          </div>
        )}
      </div>
    </main>
  );
}