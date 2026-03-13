"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();

  // Check if user is logged in
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // If no session, redirect back to login
        router.push("/login");
      }
    };

    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[url('/snowflakes.png')] bg-cover bg-center text-white">
      <div className="bg-gradient-to-br from-green-500 via-red-400 to-pink-500 rounded-lg shadow-xl p-10 max-w-2xl w-full text-center relative ring-4 ring-red-200">
        
        {/* Festive header */}
        <Image
          src="/bells-holly.png"
          alt="Bells Holly"
          width={96}
          height={96}
          className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-20 animate-bounce"
        />

        <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">🎁 GiftDraw Dashboard</h1>
        <p className="mb-6 text-lg">Welcome to your Secret Santa hub!</p>

        {/* Example dashboard actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => router.push("/create-group")}
            className="bg-white text-red-600 font-semibold py-4 rounded-lg shadow hover:bg-red-100 transition"
          >
            ➕ Create a Group
          </button>
          <button
            onClick={() => router.push("/invitations")}
            className="bg-white text-green-600 font-semibold py-4 rounded-lg shadow hover:bg-green-100 transition"
          >
            ✉️ Send Invitations
          </button>
          <button
            onClick={() => router.push("/draw-names")}
            className="bg-white text-blue-600 font-semibold py-4 rounded-lg shadow hover:bg-blue-100 transition"
          >
            🎲 Draw Names
          </button>
          <button
            onClick={() => router.push("/results")}
            className="bg-white text-purple-600 font-semibold py-4 rounded-lg shadow hover:bg-purple-100 transition"
          >
            🎁 Reveal Results
          </button>
        </div>

        {/* Footer decorations */}
        <div className="mt-10 flex gap-6 justify-center">
          <Image src="/gifts.png" alt="Gifts" width={96} height={96} className="animate-pulse" />
          <Image src="/santa-hat.png" alt="Santa Hat" width={96} height={96} className="animate-wiggle" />
        </div>
      </div>
    </div>
  );
}