import { createClient } from "@/lib/supabase/server";
import { deleteGroup } from "./actions";
import InviteForm from "./InviteForm";
import NicknameForm from "./NicknameForm";

// ─── Member type ───
// Describes what each row in group_members looks like.
type Member = {
  user_id: string | null;   // null = hasn't registered yet (pending)
  nickname: string | null;   // their anonymous display name
  email: string | null;      // we NEVER show this to users
  role: string;              // "owner" or "member"
};

export default async function GroupDetails({
  params,
}: {
  params: Promise<{ id: string }>; // Next.js 16: params is a Promise
}) {
  // ─── Get the group ID from the URL ───
  const { id } = await params;

  if (!id) {
    return <div>Invalid group ID</div>;
  }

  // ─── Create server-side Supabase client ───
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

  // ─── Check if current user is the owner ───
  const isOwner = user?.id === groupData.owner_id;

  // ─── Fetch all members of this group ───
  const { data: membersData, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, nickname, email, role")
    .eq("group_id", id);

  if (membersError) {
    console.error("Error loading members:", membersError);
    return <div>Error loading members</div>;
  }

  const members: Member[] = (membersData ?? []) as Member[];

  // ─── Count statuses ───
  const joinedCount = members.filter((m) => m.user_id !== null).length;
  const pendingCount = members.filter((m) => m.user_id === null).length;

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
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold">
            ✅ Joined: {joinedCount}
          </div>
          <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg text-sm font-bold">
            ⏳ Pending: {pendingCount}
          </div>
          <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold">
            👥 Total: {members.length}
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

        {/* ─── Participants List ─── */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          🎄 Participants
        </h2>

        {members.length === 0 ? (
          <p className="text-gray-600 text-center">
            No members invited yet. Use the invite form above!
          </p>
        ) : (
          <ul className="space-y-3">
            {members.map((m, index) => {
              // ─── Is this card the current logged-in user? ───
              const isCurrentUser = user?.id === m.user_id;

              return (
                <li
                  key={m.user_id || index}
                  className={`rounded-lg p-4 shadow-md font-semibold transition transform hover:scale-105 ${
                    m.user_id
                      ? "bg-gradient-to-r from-green-300 to-green-500 text-white"
                      : "bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600"
                  }`}
                >
                  {/* ─── If this is the current user's card ─── */}
                  {/* Show NicknameForm which handles BOTH displaying 
                      the name AND editing it. Updates in real-time. */}
                  {isCurrentUser ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <span>🎁 You</span>
                        <span className="text-xs px-3 py-1 rounded-full font-bold bg-white/30 text-white">
                          Joined ✓
                        </span>
                      </div>
                      {/* NicknameForm handles showing current name + edit button */}
                      <NicknameForm
                        groupId={id}
                        currentNickname={m.nickname || ""}
                      />
                    </div>
                  ) : (
                    // ─── Other members: just show their name + status ───
                    <div className="flex items-center justify-between">
                      <span>
                        {m.user_id ? "🎁 " : "⏳ "}
                        {m.nickname || `Participant ${index + 1}`}
                      </span>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold ${
                          m.user_id
                            ? "bg-white/30 text-white"
                            : "bg-yellow-400/30 text-yellow-800"
                        }`}
                      >
                        {m.user_id ? "Joined ✓" : "Pending"}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* ─── Info box (owner only) ─── */}
        {pendingCount > 0 && isOwner && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            💡 <strong>Pending members</strong> haven&apos;t created an account yet.
            Share your app link with them — they need to register and log in.
            Once they do, their status will change to &quot;Joined&quot; automatically.
          </div>
        )}
      </div>
    </main>
  );
}