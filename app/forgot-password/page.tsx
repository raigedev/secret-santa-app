"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

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

const FIELD_CLASS_NAME =
  "mt-2 w-full rounded-[1.5rem] bg-[#e5e9e6] px-4 py-3.5 text-[15px] text-[#2e3432] outline outline-1 outline-[#aeb3b1]/30 transition placeholder:text-[#777c7a] focus:bg-white focus:outline-[#a43c3f]/35 focus:outline-2 focus:outline-offset-0 focus:outline";

function ForgotPasswordLayout({
  children,
  supportingCopy,
}: {
  children: ReactNode;
  supportingCopy: string;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f9faf8] px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(252,206,114,0.32),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(164,60,63,0.16),_transparent_32%),linear-gradient(180deg,_#fbfcfa_0%,_#f2f4f2_100%)]" />
      <div className="absolute inset-0 bg-[url('/snowflakes.svg')] bg-size-[320px_320px] bg-repeat opacity-10" />
      <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[#ffaba9]/30 blur-3xl" />
      <div className="absolute bottom-[-9rem] right-[-5rem] h-80 w-80 rounded-full bg-[#d7fadb]/60 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <div className="grid w-full gap-4 rounded-[2.25rem] bg-white/72 p-3 shadow-[0_32px_90px_rgba(46,52,50,0.08)] backdrop-blur-xl lg:grid-cols-[1.02fr_0.98fr] lg:p-4">
          <section className="relative overflow-hidden rounded-[1.9rem] bg-[#ecefec] px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.72),_transparent_54%),linear-gradient(180deg,_rgba(255,255,255,0.18)_0%,_rgba(236,239,236,0.98)_100%)]" />
            <div className="absolute right-[-2rem] top-8 h-28 w-28 rounded-full bg-[#fcce72]/35 blur-2xl" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7b5902] shadow-[0_16px_32px_rgba(123,89,2,0.08)]">
                  Password help
                </div>
                <h2 className="mt-6 max-w-xl font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.06em] text-[#2e3432] sm:text-5xl lg:text-[3.2rem] lg:leading-[1.02]">
                  Get back into your account.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#5b605e] sm:text-lg">
                  Enter your account email. We will send a reset link so you can choose a new
                  password.
                </p>
                <div className="mt-6 rounded-[1.75rem] bg-white/82 p-5 text-sm leading-6 text-[#43614a] shadow-[0_20px_45px_rgba(62,92,69,0.08)]">
                  {supportingCopy}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[2rem] bg-white/82 p-5 shadow-[0_24px_56px_rgba(46,52,50,0.06)]">
                <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,_rgba(252,206,114,0.22),_transparent)]" />
                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div className="max-w-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b5902]">
                      What happens next
                    </p>
                    <h3 className="mt-2 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.05em] text-[#2e3432]">
                      Use the link in your email, then sign in with your new password.
                    </h3>
                  </div>
                  <Image
                    src="/bells-holly.svg"
                    alt="Holiday greenery"
                    width={160}
                    height={160}
                    className="hidden w-24 shrink-0 drop-shadow-[0_18px_30px_rgba(123,89,2,0.16)] sm:block"
                  />
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {RESET_MARKERS.map((marker) => (
                    <div key={marker.title} className="rounded-[1.35rem] bg-[#f2f4f2] p-4">
                      <p className="text-sm font-semibold text-[#2e3432]">{marker.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#5b605e]">{marker.copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.9rem] bg-white px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            {children}
          </section>
        </div>
      </div>
    </main>
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
        <h1 className="mt-4 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432] sm:text-4xl">
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
              className={FIELD_CLASS_NAME}
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
