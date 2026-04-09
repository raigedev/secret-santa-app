"use client";

import { useState } from "react";
// ✅ Use the new client helper instead of the old supabaseClient
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient(); // ✅ Create Supabase browser client
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  // ✅ Handle sending reset password email
  const handleReset = async () => {
    if (!email) {
      setMessage("⚠️ Please enter your registered email.");
      return;
    }

    // Supabase will send a reset email with a link to your reset-password page
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Must match your deployed reset-password route
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage("❌ Error sending reset email. Please check your email address.");
    } else {
      setMessage("✅ Password reset email sent! Check your inbox.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-lg bg-white p-5 text-center shadow-lg sm:p-6">
        {/* Title */}
        <h1 className="mb-4 text-2xl font-bold text-blue-700 sm:text-[28px]">Forgot Password</h1>
        <p className="mb-4 text-sm text-gray-600 sm:text-base">
          Enter your <span className="font-semibold">registered email</span> to receive a reset link.
        </p>

        {/* Email input */}
        <input
          type="email"
          placeholder="Enter your registered email"
          className="mb-4 w-full rounded border border-gray-400 bg-white p-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Send reset link button */}
        <button
          onClick={handleReset}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        >
          Send Reset Link
        </button>

        {/* Success or error message */}
        {message && <p className="mt-4 text-green-600">{message}</p>}
      </div>
    </main>
  );
}
