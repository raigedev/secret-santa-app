import { createClient } from "@/lib/supabase/server";
import { deleteGroup } from "./actions";
import InviteForm from "./InviteForm";

// This describes what a member looks like when we get it from the database.
// "type" in TypeScript is like a blueprint — it tells our code what shape
// the data will be, so we don't accidentally use wrong fields.
type Member = {
  user_id: string | null;   // null = hasn't registered yet
  nickname: string | null;   // their display name
  email: string | null;      // their email address
  role: string;              // "owner" or "member"
};

export default async function GroupDetails({
  params,
}: {
  params: Promise<{ id: string }>; // Next.js 16 requires params to be a Promise
}) {
  // In Next.js 16, "params" is a Promise, so we must "await" it
  // before we can read the group ID from the URL.
  // Example URL: /group/abc-123 → id = "abc-123"
  const { id } = await params;

  // Safety check: if there's no ID in the URL, show an error
  if (!id) {
    return <div>Invalid group ID</div>;
  }

  // Create a Supabase client that runs on the SERVER.
  // This is different from the browser client — it can read cookies
  // to know which user is logged in.
  const supabase = await createClient();

  // ─── Get the current logged-in user ───
  // We need this to know if the current user is the owner,
  // so we can show/hide the delete button and invite form.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── Fetch group details from the database ───
  // Go to the "groups" table, get the row where id matches,
  // and return the name, description, event_date, and owner_id columns.
  // "maybeSingle()" means: return null if not found (instead of crashing).
  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .select("name, description, event_date, owner_id")
    .eq("id", id)
    .maybeSingle();

  // If the database query failed, show an error
  if (groupError) {
    console.error("Error loading group:", groupError);
    return <div>Error loading group</div>;
  }

  // If no group was found with that ID, show not found
  if (!groupData) {
    return <div>Group not found</div>;
  }

  // ─── Check if current user is the group owner ───
  // We use this to decide whether to show the invite form and delete button.
  // Only the owner should be able to invite people or delete the group.
  const isOwner = user?.id === groupData.owner_id;

  // ─── Fetch all members of this group ───
  // Go to "group_members" table, get all rows where group_id matches.
  // We get user_id, nickname, email, and role for each member.
  const { data: membersData, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, nickname, email, role")
    .eq("group_id", id);

  if (membersError) {
    console.error("Error loading members:", membersError);
    return <div>Error loading members</div>;
  }

  // ─── Filter out the owner from the members list ───
  // For a Secret Santa app, we want ANONYMITY.
  // The owner (organizer) should NOT appear in the members list
  // so no one knows who's organizing the exchange.
  const members: Member[] = (membersData ?? []).filter(
    (m) => m.role !== "owner"
  ) as Member[];

  // ─── Count members by status ───
  // If user_id is null → they haven't registered yet → "Pending"
  // If user_id exists → they created an account and logged in → "Joined"
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

        {/* Show description if the group has one */}
        {groupData.description && (
          <p className="text-gray-600 mb-2">{groupData.description}</p>
        )}

        {/* Show event date */}
        <p className="text-sm text-gray-500 mb-6">
          📅 Event Date: {groupData.event_date}
        </p>

        {/* ─── Status Summary ─── */}
        {/* Shows how many members joined vs still pending */}
        <div className="flex gap-4 mb-6">
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

        {/* ─── Invite Form (only visible to the group owner) ─── */}
        {/* We check isOwner so regular members can't invite people */}
        {isOwner && <InviteForm groupId={id} />}

        {/* ─── Delete Group Button (only visible to the group owner) ─── */}
        {isOwner && (
          <form action={deleteGroup} className="mb-6">
            {/* Hidden input passes the group ID to the server action */}
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition"
            >
              🗑️ Delete Group
            </button>
          </form>
        )}

        {/* ─── Members List ─── */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          🎄 Participants
        </h2>

        {members.length === 0 ? (
          <p className="text-gray-600 text-center">
            No members invited yet. Use the invite form above!
          </p>
        ) : (
          <ul className="space-y-3">
            {members.map((m, index) => (
              <li
                key={m.user_id || index}
                className={`rounded-lg p-4 shadow-md font-semibold transition transform hover:scale-105 flex items-center justify-between ${
                  // If user_id exists → they joined → green card
                  // If user_id is null → still pending → gray card
                  m.user_id
                    ? "bg-gradient-to-r from-green-300 to-green-500 text-white"
                    : "bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600"
                }`}
              >
                {/* ─── Member nickname ─── */}
                {/* Only show nickname, NOT email — for anonymity */}
                <span>
                  {m.user_id ? "🎁 " : "⏳ "}
                  {m.nickname || "Anonymous"}
                </span>

                {/* ─── Status badge ─── */}
                {/* Shows whether this person has registered or not */}
                <span
                  className={`text-xs px-3 py-1 rounded-full font-bold ${
                    m.user_id
                      ? "bg-white/30 text-white"
                      : "bg-yellow-400/30 text-yellow-800"
                  }`}
                >
                  {m.user_id ? "Joined ✓" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* ─── Info box for pending members ─── */}
        {/* This helps the owner understand what "Pending" means */}
        {pendingCount > 0 && isOwner && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            💡 <strong>Pending members</strong> haven&apos;t created an account yet.
            They need to register at your app and log in — once they do,
            their status will automatically change to &quot;Joined&quot;.
          </div>
        )}
      </div>
    </main>
  );
}