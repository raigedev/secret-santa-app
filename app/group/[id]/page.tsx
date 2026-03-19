import { createClient } from "@/lib/supabase/server";
import { deleteGroup } from "./actions";
import InviteForm from "./InviteForm";

type Member = {
  user_id: string | null;
  nickname: string | null;
  email: string | null;
  role: string;
};

export default async function GroupDetails({
  params,
}: {
  params: Promise<{ id: string }>; // ✅ Next.js 16: params is a Promise
}) {
  // ✅ Must await params before using it
  const { id } = await params;

  // Guard: if no ID somehow, show error
  if (!id) {
    return <div>Invalid group ID</div>;
  }

  // Create Supabase server client (reads cookies for auth)
  const supabase = await createClient();

  // Fetch group info by ID
  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .select("name, description, event_date, owner_id")
    .eq("id", id)
    .maybeSingle(); // returns null instead of error if not found

  if (groupError) {
    console.error("Error loading group:", groupError);
    return <div>Error loading group</div>;
  }

  if (!groupData) {
    return <div>Group not found</div>;
  }

  // Fetch all members of this group
  const { data: membersData, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, nickname, email, role")
    .eq("group_id", id);

  if (membersError) {
    console.error("Error loading members:", membersError);
    return <div>Error loading members</div>;
  }

  const members: Member[] = (membersData ?? []) as Member[];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 via-white to-yellow-200 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 max-w-2xl w-full p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">
        <h1 className="text-3xl font-bold text-yellow-700 drop-shadow-lg mb-2">
          🎁 {groupData.name}
        </h1>

        {/* Show description if it exists */}
        {groupData.description && (
          <p className="text-gray-600 mb-2">{groupData.description}</p>
        )}

        {/* Show event date */}
        <p className="text-sm text-gray-500 mb-6">
          📅 Event Date: {groupData.event_date}
        </p>

        {/* Invite form component */}
        <InviteForm groupId={id} />

        {/* Delete group button */}
        <form action={deleteGroup} className="mb-6">
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition"
          >
            🗑️ Delete Group
          </button>
        </form>

        {/* Members list */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          👥 Members ({members.length})
        </h2>

        {members.length === 0 ? (
          <p className="text-gray-600 text-center">No members yet.</p>
        ) : (
          <ul className="space-y-3">
            {members.map((m, index) => (
              <li
                key={m.user_id || index}
                className="rounded-lg p-4 shadow-md bg-gradient-to-r from-yellow-300 to-yellow-500 text-white font-semibold hover:scale-105 transition transform flex items-center justify-between"
              >
                {/* Show name with crown for owner */}
                <span>
                  {m.role === "owner" ? "👑 " : "🎁 "}
                  {m.nickname || m.email?.split("@")[0] || "Anonymous"}
                </span>

                {/* Show role badge */}
                <span className="text-xs bg-white/30 px-2 py-1 rounded-full">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}