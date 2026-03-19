"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Group = {
  id: string;
  name: string;
  description?: string;
  event_date: string;
  owner_id: string;
  invites: string[];
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userName, setUserName] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const checkSessionAndGroups = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const email = session.user.email || "Guest";
      setUserName(email.split("@")[0]);

      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .or(`owner_id.eq.${session.user.id},invites.cs.{${email}}`);

      if (error) {
        console.error(error);
        setErrorMsg("Failed to load groups. Please try again.");
        setGroups([]);
      } else {
        setGroups((data as Group[]) || []);
      }

      setLoading(false);
    };

    checkSessionAndGroups();

    // ✅ Correct subscription handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          router.push("/login");
        } else {
          const email = session.user.email || "Guest";
          setUserName(email.split("@")[0]);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg font-semibold text-blue-700">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 text-gray-900 relative">
      {/* subtle snow overlay */}
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>
      <div className="relative z-10 text-center max-w-5xl w-full p-10 rounded-xl shadow-xl bg-white/40 backdrop-blur-md">
        <h1 className="text-4xl font-bold mb-2 drop-shadow-lg" style={{ color: "#1E3A8A" }}>
          🎁 GiftDraw Dashboard 🎅
        </h1>
        <p className="text-lg mb-8 font-semibold" style={{ color: "#334155" }}>
          Welcome, {userName} 🎁
        </p>

        {errorMsg && (
          <div className="mb-6 text-red-600 font-semibold">{errorMsg}</div>
        )}

        {/* Festive Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Secret Santa Card */}
          <div
            className="text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #F87171, #EF4444)", boxShadow: "0 0 20px rgba(239, 68, 68, 0.7)" }}
          >
            <div className="bg-white text-red-700 font-bold py-2 text-center rounded-t-[2rem]">🔍🎅 Your Secret Santa</div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>Assignments will appear here</p>
              <div className="mt-4 flex justify-center gap-2 text-xl">🎁 🌲 🍬</div>
            </div>
          </div>

          {/* Gift Ideas Card */}
          <div
            className="text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #86EFAC, #22C55E)", boxShadow: "0 0 20px rgba(34, 197, 94, 0.7)" }}
          >
            <div className="bg-white text-green-700 font-bold py-2 text-center rounded-t-[2rem]">💡🎅 Gift Ideas</div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>Share and explore festive gift ideas</p>
              <div className="mt-4 flex justify-center gap-2 text-xl">❄️ 🎁 🍬</div>
            </div>
          </div>

          {/* Create Group Card */}
          <div
            onClick={() => router.push("/create-group")}
            className="cursor-pointer text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #60A5FA, #3B82F6)", boxShadow: "0 0 20px rgba(59, 130, 246, 0.7)" }}
          >
            <div className="bg-white text-blue-700 font-bold py-2 text-center rounded-t-[2rem]">📋🎉 Create Group</div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>Start a new Secret Santa event</p>
              <div className="mt-4 flex justify-center gap-2 text-xl">🎊 🎄 🎁</div>
            </div>
          </div>
        </div>

        {/* Groups List */}
        <div className="text-left mb-10">
          <h2 className="text-2xl font-bold mb-6 text-blue-700">🎄 Your Groups</h2>
          {groups.length === 0 ? (
            <p className="text-gray-600">No groups yet. Create one to get started!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => router.push(`/group/${group.id}`)}
                  className="cursor-pointer rounded-xl p-6 shadow-lg hover:scale-105 transition transform relative overflow-hidden text-white"
                  style={{
                    background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
                    boxShadow: "0 0 20px rgba(251, 191, 36, 0.7)",
                  }}
                >
                  <div className="bg-white text-yellow-700 font-bold py-2 px-4 rounded-t-lg text-center">
                    🎁 {group.name}
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-800 mb-2">{group.description}</p>
                    <p className="text-sm text-gray-600">📅 Event Date: {group.event_date}</p>
                    <div className="mt-4 flex justify-center gap-2 text-xl">🎄 🎁 🍬</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            className="text-white font-bold px-6 py-3 rounded-full hover:scale-105 transition flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
              boxShadow: "0 0 20px rgba(251, 191, 36, 0.7)",
            }}
          >
            🍭 Logout
          </button>
        </div>
      </div>
    </main>
  );
}