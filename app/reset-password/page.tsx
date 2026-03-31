"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleUpdatePassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMessage(error.message || "Error updating password.");
      return;
    }

    setMessage("Password updated successfully!");

    // Sign out after a successful password reset so the user comes back through
    // a fresh login with the new credential.
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 2000);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-white px-4">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600 flex items-center justify-center">
          Reset Password
        </h1>

        <input
          type="password"
          placeholder="Enter new password"
          className="border-2 border-red-600 bg-white text-black p-3 rounded w-full mb-3 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />

        <p className="mb-4 text-xs text-gray-500">
          Use at least {MIN_PASSWORD_LENGTH} characters.
        </p>

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
