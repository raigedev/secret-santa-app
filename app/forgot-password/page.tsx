"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  AUTH_FIELD_CLASS_NAME,
  AuthHeroPanel,
  AuthPageFrame,
} from "@/app/components/AuthPageShell";
import { createClient } from "@/lib/supabase/client";

const RESET_MARKERS = [
  {
    title: "Secure reset link",
    copy: "We send the reset step to your email so only you can change the password.",
  },
  {
    title: "Check your inbox",
    copy: "Open the email, tap the reset link, and choose a new password.",
  },
  {
    title: "Sign in again",
    copy: "After the password is changed, use the new one to sign in.",
  },
] as const;

function ForgotPasswordLayout({
  children,
  supportingCopy,
}: {
  children: ReactNode;
  supportingCopy: string;
}) {
  return (
    <AuthPageFrame>
      <AuthHeroPanel
        badge="Password help"
        title="Get back into your account."
        titleClassName="lg:text-[3.2rem]"
        description="Enter your account email. We will send a reset link so you can choose a new password."
        supportingCopy={supportingCopy}
        detailEyebrow="What happens next"
        detailTitle="Use the link in your email, then sign in with your new password."
        markers={RESET_MARKERS}
      />

      <section className="rounded-[1.9rem] bg-white px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        {children}
      </section>
    </AuthPageFrame>
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"idle" | "error" | "success">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = async () => {
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    setMessage("");
    setMessageTone("idle");

    if (!trimmedEmail) {
      setMessage("Enter the email address for your account.");
      setMessageTone("error");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage("We could not send the reset email right now. Please try again.");
      setMessageTone("error");
      setIsSubmitting(false);
      return;
    }

    setMessage("If that email belongs to an account, a reset link is on its way. Check your inbox.");
    setMessageTone("success");
    setIsSubmitting(false);
  };

  return (
    <ForgotPasswordLayout supportingCopy="Use the email connected to your account. After the password is changed, sign in again with the new one.">
      <div className="mx-auto w-full max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fcce72]/28 px-3 py-1.5 text-sm font-semibold text-[#5f4500]">
          Account recovery
        </div>
        <h1 className="mt-4 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-tighter text-[#2e3432] sm:text-4xl">
          Forgot Password
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-[#5b605e] sm:text-base">
          Enter the email address for your account. If we find it, we will send a password reset
          link there.
        </p>

        <form
          className="mt-8 space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleReset();
          }}
        >
          <div>
            <label htmlFor="forgot-password-email" className="text-sm font-semibold text-[#2e3432]">
              Account email
            </label>
            <input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              placeholder="Enter your email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={AUTH_FIELD_CLASS_NAME}
            />
          </div>

          {message ? (
            <div
              role={messageTone === "error" ? "alert" : "status"}
              className={
                messageTone === "error"
                  ? "rounded-[1.35rem] bg-[#fff1ef] px-4 py-3 text-sm leading-6 text-[#821a01]"
                  : "rounded-[1.35rem] bg-[#eef8f0] px-4 py-3 text-sm leading-6 text-[#315238]"
              }
            >
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[linear-gradient(135deg,#a43c3f_0%,#943034_100%)] px-6 py-4 text-base font-semibold text-[#fff7f6] shadow-[0_24px_55px_rgba(164,60,63,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_30px_60px_rgba(164,60,63,0.24)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
          >
            {isSubmitting ? "Sending reset link..." : "Email Reset Link"}
          </button>

          <div className="rounded-[1.35rem] bg-[#f2f4f2] px-4 py-4 text-sm leading-6 text-[#5b605e]">
            For your safety, the password reset happens from the email link.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[#5b605e]">Remember your password?</p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-full bg-[linear-gradient(135deg,#48664e_0%,#3c5a43_100%)] px-5 py-3 text-sm font-semibold text-[#f7fbf8] shadow-[0_18px_38px_rgba(60,90,67,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_46px_rgba(60,90,67,0.24)]"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </ForgotPasswordLayout>
  );
}
