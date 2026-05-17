"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AUTH_FIELD_CLASS_NAME,
  AuthHeroPanel,
  AuthPageFrame,
} from "@/app/components/AuthPageShell";
import { getPasswordPolicyMessage, PASSWORD_POLICY_HELP_TEXT } from "@/lib/auth/password-policy";
import { clearAppSessionStorage } from "@/lib/client-snapshot";
import { createClient } from "@/lib/supabase/client";

const RESET_PASSWORD_MARKERS = [
  {
    title: "Choose a fresh password",
    copy: "Use a phrase you do not reuse on other sites.",
  },
  {
    title: "We sign you out",
    copy: "After saving, you will log in again with the new password.",
  },
  {
    title: "Keep it private",
    copy: "Never share reset links or passwords with anyone.",
  },
] as const;

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
    <AuthPageFrame>
      <AuthHeroPanel
        badge="Password reset"
        title="Choose your new password."
        titleClassName="lg:text-[3.2rem]"
        description="Set a strong password, then sign in again with the new one."
        supportingCopy="This page only works from a valid reset email link."
        detailEyebrow="Account safety"
        detailTitle="A longer password phrase is easier to remember and harder to guess."
        markers={RESET_PASSWORD_MARKERS}
      />

      <section className="rounded-[1.9rem] bg-white px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#fcce72]/28 px-3 py-1.5 text-sm font-semibold text-[#5f4500]">
            Account security
          </div>
          <h1 className="mt-4 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-tighter text-[#2e3432] sm:text-4xl">
            Reset Password
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-[#5b605e] sm:text-base">
            Enter the new password you want to use for your Secret Santa account.
          </p>

          <div className="mt-8 space-y-5">
            <div>
              <label htmlFor="reset-password-new-password" className="text-sm font-semibold text-[#2e3432]">
                New password
              </label>
              <input
                id="reset-password-new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Enter your new password"
                className={AUTH_FIELD_CLASS_NAME}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            <div className="rounded-[1.35rem] bg-[#f2f4f2] px-4 py-3 text-sm leading-6 text-[#5b605e]">
              {PASSWORD_POLICY_HELP_TEXT}
            </div>

            <button
              type="button"
              onClick={handleUpdatePassword}
              className="gift-button gift-button-red gift-button-full gift-button-wide py-4 text-base"
            >
              Save New Password
            </button>

            {message && (
              <div
                role={message.includes("could not") ? "alert" : "status"}
                className="rounded-[1.35rem] bg-[#eef8f0] px-4 py-3 text-sm leading-6 text-[#315238]"
              >
                {message}
              </div>
            )}
          </div>
        </div>
      </section>
    </AuthPageFrame>
  );
}
