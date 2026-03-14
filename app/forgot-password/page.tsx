"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://secret-santa-app-navy.vercel.app/reset-password",
    });

    if (error) {
      setMessage("Error sending reset email.");
      console.error(error.message);
    } else {
      setMessage("Password reset email sent!");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      <h1 className="text-2xl font-bold mb-4 text-blue-700">Forgot Password</h1>
      <input
        type="email"
        placeholder="Enter your email"
        className="border p-2 rounded w-full max-w-sm mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        onClick={handleReset}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Send Reset Link
      </button>
      {message && <p className="mt-4 text-green-600">{message}</p>}
    </main>
  );
}