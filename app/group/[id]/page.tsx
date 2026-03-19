import { createClient } from "@/lib/supabase/server";
import { deleteGroup } from "./actions";
import InviteForm from "./InviteForm";

type Member = {
  user_id: string;
  nickname?: string;
  email?: string;
};

export default async function GroupDetails({ params }: { params: { id: string } }) {
  const { id } = params;
  const supabase = await createClient();

  if (!id) {
    return <div>Invalid group ID</div>;
  }

  // Fetch group info
  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  if (groupError) {
    console.error(groupError);
    return <div>Error loading group</div>;
  }

  if (!groupData) {
    return <div>Group not found</div>;
  }

  // Fetch members
  const { data: membersData, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, nickname, email")
    .eq("group_id", id);

  if (membersError) {
    console.error(membersError);
    return <div>Error loading members</div>;
  }

  const members: Member[] = (membersData ?? []) as Member[];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 via-white to-yellow-200 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 max-w-2xl w-full p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">
        <h1 className="text-3xl font-bold text-yellow-700 drop-shadow-lg mb-6">
          🎁 {groupData.name} Members
        </h1>

        {/* InviteForm component */}
        <InviteForm groupId={id} />

        {/* Delete Group Button */}
        <form action={deleteGroup} className="mb-6">
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition"
          >
            Delete Group
          </button>
        </form>

        {members.length === 0 ? (
          <p className="text-gray-600 text-center">No members yet.</p>
        ) : (
          <ul className="space-y-3">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="rounded-lg p-4 shadow-md bg-gradient-to-r from-yellow-300 to-yellow-500 text-white font-semibold hover:scale-105 transition transform"
              >
                {m.nickname || m.email || "Anonymous"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}