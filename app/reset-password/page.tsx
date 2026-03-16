"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleUpdatePassword = async () => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMessage("❌ Error updating password.");
      console.error(error.message);
    } else {
      setMessage("✅ Password updated successfully!");
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-white px-4">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600 flex items-center justify-center">
          🔑 Reset Password
        </h1>
        <input
          type="password"
          placeholder="Enter new password"
          className="border-2 border-red-600 bg-white text-black p-3 rounded w-full mb-4 
                     focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button
          onClick={handleUpdatePassword}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition w-full"
        >
          Update Password
        </button>
        {message && <p className="mt-4 text-green-600">{message}</p>}
      </div>
    </main>
  );
}