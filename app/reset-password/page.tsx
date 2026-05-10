"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getPasswordPolicyMessage, PASSWORD_POLICY_HELP_TEXT } from "@/lib/auth/password-policy";
import { clearAppSessionStorage } from "@/lib/client-snapshot";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleUpdatePassword = async () => {
    const passwordPolicyMessage = getPasswordPolicyMessage(newPassword, "new password");
    if (passwordPolicyMessage) {
      setMessage(passwordPolicyMessage);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMessage("We could not update your password. Please try the reset link again.");
      return;
    }

    setMessage("Your password has been updated. Taking you back to login...");

    // Sign out after a successful password reset so the user comes back through
    // a fresh login with the new credential.
    clearAppSessionStorage();
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
          placeholder="Enter your new password"
          className="mb-3 w-full rounded border-2 border-red-600 bg-white p-3 text-black shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />

        <p className="mb-4 text-xs text-gray-500">{PASSWORD_POLICY_HELP_TEXT}</p>

        <button
          onClick={handleUpdatePassword}
          className="w-full rounded bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
        >
          Save New Password
        </button>

        {message && <p className="mt-4 text-green-600">{message}</p>}
      </div>
    </main>
  );
}
