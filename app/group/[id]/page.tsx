import { createClient } from "@/lib/supabase/server";
import { deleteGroup, inviteUser } from "./actions";

type Member = {
  user_id: string;
  nickname?: string;
};

export default async function GroupDetails(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  console.log("Group ID param:", id);

  const supabase = await createClient();

  if (!id) return <div>Invalid group ID</div>;

  const { data: groupData } = await supabase
    .from("groups")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  if (!groupData) return <div>Group not found</div>;

  const { data: membersData } = await supabase
    .from("group_members")
    .select("user_id, nickname")
    .eq("group_id", id);

  const members: Member[] = (membersData ?? []) as Member[];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 via-white to-yellow-200 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 max-w-2xl w-full p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">
        <h1 className="text-3xl font-bold text-yellow-700 drop-shadow-lg mb-6">
          🎁 {groupData.name} Members
        </h1>

        {/* INVITE USER FORM */}
        <form action={inviteUser} className="mb-6 flex gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            type="email"
            name="email"
            placeholder="Enter email to invite"
            className="flex-1 px-3 py-2 border rounded-lg"
            required
          />
          <button
            type="submit"
            className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
          >
            Invite
          </button>
        </form>

        {/* DELETE GROUP BUTTON */}
        <form action={deleteGroup}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="mb-6 bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition"
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
                {m.nickname || "Anonymous"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}