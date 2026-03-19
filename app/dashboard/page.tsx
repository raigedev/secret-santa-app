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
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSessionAndGroups = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const email = session.user.email || "Guest";
      setUserName(email.split("@")[0]);

      // Owned groups
      const { data: owned } = await supabase
        .from("groups")
        .select("*")
        .eq("owner_id", session.user.id);
      setOwnedGroups((owned as Group[]) || []);

      // Invited groups
      const { data: invited } = await supabase
        .from("groups")
        .select("*")
        .contains("invites", [email]);
      setInvitedGroups((invited as Group[]) || []);

      setLoading(false);
    };

    checkSessionAndGroups();

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
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>
      <div className="relative z-10 text-center max-w-5xl w-full p-10 rounded-xl shadow-xl bg-white/40 backdrop-blur-md">
        <h1 className="text-4xl font-bold mb-2 drop-shadow-lg" style={{ color: "#1E3A8A" }}>
          🎁 GiftDraw Dashboard 🎅
        </h1>
        <p className="text-lg mb-8 font-semibold" style={{ color: "#334155" }}>
          Welcome, {userName} 🎁
        </p>

        {/* Festive Cards */}
        {/* ... Secret Santa, Gift Ideas, Create Group cards ... */}

        {/* Owned Groups */}
        <div className="text-left mb-10">
          <h2 className="text-2xl font-bold mb-6 text-blue-700">🎄 Your Groups</h2>
          {ownedGroups.length === 0 ? (
            <p className="text-gray-600">You don’t own any groups yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ownedGroups.map((group) => (
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
                    🎁 {group.name} <span className="ml-2 text-xs text-gray-500">(Owner)</span>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-800 mb-2">{group.description}</p>
                    <p className="text-sm text-gray-600">📅 Event Date: {group.event_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invited Groups */}
        <div className="text-left mb-10">
          <h2 className="text-2xl font-bold mb-6 text-green-700">🎁 Invited Groups</h2>
          {invitedGroups.length === 0 ? (
            <p className="text-gray-600">No pending invites yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {invitedGroups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => router.push(`/group/${group.id}`)}
                  className="cursor-pointer rounded-xl p-6 shadow-lg hover:scale-105 transition transform relative overflow-hidden text-white"
                  style={{
                    background: "linear-gradient(135deg, #34D399, #059669)",
                    boxShadow: "0 0 20px rgba(34, 197, 94, 0.7)",
                  }}
                >
                  <div className="bg-white text-green-700 font-bold py-2 px-4 rounded-t-lg text-center">
                    🎁 {group.name} <span className="ml-2 text-xs text-gray-500">(Invited)</span>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-800 mb-2">{group.description}</p>
                    <p className="text-sm text-gray-600">📅 Event Date: {group.event_date}</p>
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