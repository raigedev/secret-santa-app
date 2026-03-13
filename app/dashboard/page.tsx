"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");

  // Check if user is logged in
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
      } else {
        // Grab user info (e.g., email or custom metadata)
        const email = session.user.email || "Guest";
        setUserName(email.split("@")[0]); // show before @ as username
      }
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-400 to-red-300 text-white relative">
      {/* Snow background */}
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      {/* Dashboard content */}
      <div className="relative z-10 text-center max-w-2xl w-full p-10 rounded-lg shadow-xl bg-white/10 backdrop-blur-md">
        <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">
          🎁 GiftDraw Dashboard 🎅
        </h1>
        <p className="text-lg mb-6">Welcome, {userName} 🎁</p>

        {/* Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white text-red-600 font-semibold py-6 rounded-lg shadow hover:bg-red-100 transition">
            <h2 className="text-xl mb-2">Your Secret Santa</h2>
            <p className="text-sm">Assignments will appear here</p>
          </div>
          <div className="bg-white text-green-600 font-semibold py-6 rounded-lg shadow hover:bg-green-100 transition">
            <h2 className="text-xl mb-2">Gift Ideas</h2>
            <p className="text-sm">Share and explore festive gift ideas</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white font-bold px-6 py-3 rounded-lg shadow-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
        >
          🍭 Logout
        </button>
      </div>
    </main>
  );
}