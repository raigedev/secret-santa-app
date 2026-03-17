import { createClient } from "@/lib/supabase/server";

type Member = {
  user_id: string;
  nickname?: string;
  email?: string;
};

export default async function GroupDetails({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  // Fetch group info
  const { data: groupData } = await supabase
    .from("groups")
    .select("name")
    .eq("id", params.id)
    .single();

  // Fetch members (no join to auth.users)
  const { data: membersData, error } = await supabase
    .from("group_members")
    .select("user_id, nickname")
    .eq("group_id", params.id);

  if (error) {
    console.error(error);
    return <div>Error loading members</div>;
  }

  const members: Member[] = [];

  // For each member, fetch email using Admin API
  if (membersData) {
    for (const m of membersData) {
      let email: string | undefined;
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(m.user_id);
        email = userData?.user?.email;
      } catch (err) {
        console.error("Error fetching user email:", err);
      }
      members.push({
        user_id: m.user_id,
        nickname: m.nickname,
        email,
      });
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 via-white to-yellow-200 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 max-w-2xl w-full p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">
        <h1 className="text-3xl font-bold text-yellow-700 drop-shadow-lg mb-6">
          🎁 {groupData?.name} Members
        </h1>

        {members.length === 0 ? (
          <p className="text-gray-600 text-center">No members yet.</p>
        ) : (
          <ul className="space-y-3">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="rounded-lg p-4 shadow-md bg-gradient-to-r from-yellow-300 to-yellow-500 text-white font-semibold hover:scale-105 transition transform"
              >
                {m.nickname || m.email || m.user_id}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}