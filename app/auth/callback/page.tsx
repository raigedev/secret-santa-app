"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase will parse the URL fragment and set the session
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);

      if (error) {
        console.error("Auth callback error:", error.message);
        router.push("/login");
      } else {
        router.push("/dashboard");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-lg font-semibold text-blue-700">Completing sign‑in…</p>
    </main>
  );
}