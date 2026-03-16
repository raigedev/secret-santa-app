"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async () => {
    if (!email) {
      setMessage("⚠️ Please enter your registered email.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://secret-santa-app-navy.vercel.app/reset-password",
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
        <h1 className="text-2xl font-bold mb-4 text-blue-700">Forgot Password</h1>
        <p className="text-gray-600 mb-4">
          Enter your <span className="font-semibold">registered email</span> to receive a reset link.
        </p>
        <input
          type="email"
          placeholder="Enter your registered email"
          className="border border-gray-400 bg-white text-black p-3 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          onClick={handleReset}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Send Reset Link
        </button>
        {message && <p className="mt-4 text-green-600">{message}</p>}
      </div>
    </main>
  );
}