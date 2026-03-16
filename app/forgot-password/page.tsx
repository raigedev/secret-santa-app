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
      console.error(error.message);
    } else {
      setMessage("✅ Password reset email sent! Check your inbox.");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md text-center">
        {/* Title */}
        <h1 className="text-2xl font-bold mb-4 text-blue-700">Forgot Password</h1>
        <p className="text-gray-600 mb-4">
          Enter your <span className="font-semibold">registered email</span> to receive a reset link.
        </p>

        {/* Email input */}
        <input
          type="email"
          placeholder="Enter your registered email"
          className="border border-gray-400 bg-white text-black p-3 rounded w-full mb-4 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Send reset link button */}
        <button
          onClick={handleReset}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition w-full"
        >
          Send Reset Link
        </button>

        {/* Success or error message */}
        {message && <p className="mt-4 text-green-600">{message}</p>}
      </div>
    </main>
  );
}