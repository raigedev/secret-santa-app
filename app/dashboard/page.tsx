"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
      } else {
        const email = session.user.email || "Guest";
        setUserName(email.split("@")[0]);
      }
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 text-gray-900 relative">
      {/* subtle snow overlay */}
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 text-center max-w-5xl w-full p-10 rounded-xl shadow-xl bg-white/40 backdrop-blur-md ring-4 ring-sky-300">
        <h1 className="text-4xl font-bold mb-2 drop-shadow-lg text-blue-900">
          🎁 GiftDraw Dashboard 🎅
        </h1>
        <p className="text-lg mb-8 font-semibold">Welcome, {userName} 🎁</p>

        {/* Christmas-Themed Arched Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Secret Santa Card */}
          <div className="bg-red-600 text-white rounded-t-[2rem] rounded-b-xl shadow-lg hover:scale-105 transition transform relative overflow-hidden">
            <div className="bg-white text-red-700 font-bold py-2 text-center rounded-t-[2rem]">
              🔍🎅 Your Secret Santa
            </div>
            <div className="p-4 text-center">
              <p className="text-sm">Assignments will appear here</p>
              <div className="mt-4 flex justify-center gap-2 text-xl">
                🎁 🌲 🍬
              </div>
            </div>
            <div className="absolute top-2 left-2 text-xl">🍭</div>
            <div className="absolute bottom-2 right-2 text-xl">🎄</div>
          </div>

          {/* Gift Ideas Card */}
          <div className="bg-green-600 text-white rounded-t-[2rem] rounded-b-xl shadow-lg hover:scale-105 transition transform relative overflow-hidden">
            <div className="bg-white text-green-700 font-bold py-2 text-center rounded-t-[2rem]">
              💡🎅 Gift Ideas
            </div>
            <div className="p-4 text-center">
              <p className="text-sm">Share and explore festive gift ideas</p>
              <div className="mt-4 flex justify-center gap-2 text-xl">
                ❄️ 🎁 🍬
              </div>
            </div>
            <div className="absolute top-2 left-2 text-xl">🔔</div>
            <div className="absolute bottom-2 right-2 text-xl">🎀</div>
          </div>

          {/* Create Group Card */}
          <div
            onClick={() => router.push("/create-group")}
            className="cursor-pointer bg-blue-600 text-white rounded-t-[2rem] rounded-b-xl shadow-lg hover:scale-105 transition transform relative overflow-hidden"
          >
            <div className="bg-white text-blue-700 font-bold py-2 text-center rounded-t-[2rem]">
              📋🎉 Create Group
            </div>
            <div className="p-4 text-center">
              <p className="text-sm">Start a new Secret Santa event</p>
              <div className="mt-4 flex justify-center gap-2 text-xl">
                🎊 🎄 🎁
              </div>
            </div>
            <div className="absolute top-2 right-2 text-xl">🎅</div>
            <div className="absolute bottom-2 left-2 text-xl">⛄</div>
          </div>
        </div>

        {/* Centered Logout */}
        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            className="bg-blue-600 text-white font-bold px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            🍭 Logout
          </button>
        </div>
      </div>
    </main>
  );
}