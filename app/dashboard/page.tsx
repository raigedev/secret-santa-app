"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
// ✅ Use the new client helper instead of the old supabaseClient
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient(); // ✅ Create Supabase browser client
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // ✅ Get session from cookies (via @supabase/ssr client)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Redirect to login if no session
        router.push("/login");
      } else {
        const email = session.user.email || "Guest";
        setUserName(email.split("@")[0]);
      }
      setLoading(false);
    };

    checkSession();

    // ✅ Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
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
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  // ✅ Handle logout
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
        <h1
          className="text-4xl font-bold mb-2 drop-shadow-lg"
          style={{ color: "#1E3A8A" }}
        >
          🎁 GiftDraw Dashboard 🎅
        </h1>
        <p className="text-lg mb-8 font-semibold" style={{ color: "#334155" }}>
          Welcome, {userName} 🎁
        </p>

        {/* Christmas Palette Cards with Glow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Secret Santa Card */}
          <div
            className="text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #F87171, #EF4444)",
              boxShadow: "0 0 20px rgba(239, 68, 68, 0.7)", // red glow
            }}
          >
            <div className="bg-white text-red-700 font-bold py-2 text-center rounded-t-[2rem]">
              🔍🎅 Your Secret Santa
            </div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>
                Assignments will appear here
              </p>
              <div className="mt-4 flex justify-center gap-2 text-xl">
                🎁 🌲 🍬
              </div>
            </div>
          </div>

          {/* Gift Ideas Card */}
          <div
            className="text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #86EFAC, #22C55E)",
              boxShadow: "0 0 20px rgba(34, 197, 94, 0.7)", // green glow
            }}
          >
            <div className="bg-white text-green-700 font-bold py-2 text-center rounded-t-[2rem]">
              💡🎅 Gift Ideas
            </div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>
                Share and explore festive gift ideas
              </p>
              <div className="mt-4 flex justify-center gap-2 text-xl">
                ❄️ 🎁 🍬
              </div>
            </div>
          </div>

          {/* Create Group Card */}
          <div
            onClick={() => router.push("/create-group")}
            className="cursor-pointer text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #60A5FA, #3B82F6)",
              boxShadow: "0 0 20px rgba(59, 130, 246, 0.7)", // blue glow
            }}
          >
            <div className="bg-white text-blue-700 font-bold py-2 text-center rounded-t-[2rem]">
              📋🎉 Create Group
            </div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>
                Start a new Secret Santa event
              </p>
              <div className="mt-4 flex justify-center gap-2 text-xl">
                🎊 🎄 🎁
              </div>
            </div>
          </div>
        </div>

        {/* Centered Logout */}
        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            className="text-white font-bold px-6 py-3 rounded-full hover:scale-105 transition flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
              boxShadow: "0 0 20px rgba(251, 191, 36, 0.7)", // gold glow
            }}
          >
            🍭 Logout
          </button>
        </div>
      </div>
    </main>
  );
}