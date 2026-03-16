"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// ✅ Use the new client helper instead of the old supabaseClient
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient(); // ✅ Create Supabase browser client
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  // ✅ Handle password update
  const handleUpdatePassword = async () => {
    // Update the logged-in user's password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMessage("❌ Error updating password.");
      console.error(error.message);
    } else {
      setMessage("✅ Password updated successfully!");
      // Sign out the user so they must log in again
      await supabase.auth.signOut();
      // Redirect back to login after 2 seconds
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-white px-4">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md text-center">
        {/* Title */}
        <h1 className="text-2xl font-bold mb-4 text-red-600 flex items-center justify-center">
          🔑 Reset Password
        </h1>

        {/* New password input */}
        <input
          type="password"
          placeholder="Enter new password"
          className="border-2 border-red-600 bg-white text-black p-3 rounded w-full mb-4 
                     focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        {/* Update button */}
        <button
          onClick={handleUpdatePassword}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition w-full"
        >
          Update Password
        </button>

        {/* Success or error message */}
        {message && <p className="mt-4 text-green-600">{message}</p>}
      </div>
    </main>
  );
}