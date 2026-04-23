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
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-white px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-lg bg-white p-5 text-center shadow-lg sm:p-6">
        <h1 className="mb-4 flex items-center justify-center text-2xl font-bold text-red-600 sm:text-[28px]">
          Reset Password
        </h1>

        <input
          type="password"
          placeholder="Enter new password"
          className="mb-3 w-full rounded border-2 border-red-600 bg-white p-3 text-black shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />

        <p className="mb-4 text-xs text-gray-500">
          Use at least {MIN_PASSWORD_LENGTH} characters.
        </p>

        <button
          onClick={handleUpdatePassword}
          className="w-full rounded bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
        >
          Update Password
        </button>

        {message && <p className="mt-4 text-green-600">{message}</p>}
      </div>
    </main>
  );
}
