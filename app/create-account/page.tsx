"use client";

import Image from "next/image";
import { Suspense, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TRUST_MARKERS = [
  {
    title: "Invite-friendly setup",
    copy: "If you came from an invite, we keep that group ready after you confirm your email.",
  },
  {
    title: "Private by design",
    copy: "Wishlists, private messages, and recipient details stay inside your account.",
  },
  {
    title: "Ready for your group",
    copy: "After sign-in, you can join groups, add wishlist ideas, and see what to do next.",
  },
] as const;

const FIELD_CLASS_NAME =
  "mt-2 w-full rounded-[1.5rem] bg-[#e5e9e6] px-4 py-3.5 text-[15px] text-[#2e3432] outline outline-1 outline-[#aeb3b1]/30 transition placeholder:text-[#777c7a] focus:bg-white focus:outline-[#a43c3f]/35 focus:outline-2 focus:outline-offset-0 focus:outline";

function getFriendlySignupError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("error sending confirmation email") ||
    normalized.includes("smtp") ||
    normalized.includes("rate limit")
  ) {
    return "We could not send the confirmation email right now. Please try again later or contact the app owner.";
  }

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "This email already has an account. Please sign in instead.";
  }

  return message || "We could not create your account. Please try again.";
}

function getSupportingCopy(nextPath: string): string {
  if (nextPath !== "/dashboard") {
    return "Create your account and we will take you back to the invite or group you opened.";
  }

  return "Create your account once, then manage your groups, wishlist, and recipient details in one place.";
}

function CreateAccountLayout({
  children,
  supportingCopy,
}: {
  children: ReactNode;
  supportingCopy: string;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f9faf8] px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(252,206,114,0.32),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(164,60,63,0.16),_transparent_32%),linear-gradient(180deg,_#fbfcfa_0%,_#f2f4f2_100%)]" />
      <div className="absolute inset-0 bg-[url('/snowflakes.svg')] bg-[length:320px_320px] bg-repeat opacity-10" />
      <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[#ffaba9]/30 blur-3xl" />
      <div className="absolute bottom-[-9rem] right-[-5rem] h-80 w-80 rounded-full bg-[#d7fadb]/60 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <div className="grid w-full gap-4 rounded-[2.25rem] bg-white/72 p-3 shadow-[0_32px_90px_rgba(46,52,50,0.08)] backdrop-blur-xl lg:grid-cols-[1.06fr_0.94fr] lg:p-4">
          <section className="relative overflow-hidden rounded-[1.9rem] bg-[#ecefec] px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.72),_transparent_54%),linear-gradient(180deg,_rgba(255,255,255,0.18)_0%,_rgba(236,239,236,0.98)_100%)]" />
            <div className="absolute right-[-2rem] top-8 h-28 w-28 rounded-full bg-[#fcce72]/35 blur-2xl" />
            <div className="absolute bottom-4 left-6 h-24 w-24 rounded-full bg-[#a43c3f]/10 blur-2xl" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7b5902] shadow-[0_16px_32px_rgba(123,89,2,0.08)]">
                  New account
                </div>
                <h1 className="mt-6 max-w-xl font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.06em] text-[#2e3432] sm:text-5xl lg:text-[3.4rem] lg:leading-[1.02]">
                  Join your Secret Santa group.
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#5b605e] sm:text-lg">
                  Create an account so you can join groups, add wishlist ideas, and see your Secret
                  Santa details when names are drawn.
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
                      Before names are drawn
                    </p>
                    <h2 className="mt-2 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.05em] text-[#2e3432]">
                      Add gift ideas now so your Santa has helpful clues later.
                    </h2>
                  </div>
                  <Image
                    src="/bells-holly.svg"
                    alt="Holiday greenery"
                    width={144}
                    height={144}
                    className="hidden w-24 shrink-0 drop-shadow-[0_18px_30px_rgba(123,89,2,0.16)] sm:block"
                  />
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {TRUST_MARKERS.map((marker) => (
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

function CreateAccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = (() => {
    const candidate = searchParams.get("next") || "/dashboard";
    return candidate.startsWith("/") ? candidate : "/dashboard";
  })();

  const rememberNextPath = () => {
    document.cookie = `post_login_next=${encodeURIComponent(nextPath)}; Path=/; Max-Age=86400; SameSite=Lax`;
  };

  const handleSignup = async () => {
    if (isSubmitting) {
      return;
    }

    setError("");
    rememberNextPath();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const redirectUrl = new URL("/auth/callback", window.location.origin);
      redirectUrl.searchParams.set("next", nextPath);

      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { name: trimmedName },
          emailRedirectTo: redirectUrl.toString(),
        },
      });

      if (signUpError) {
        setError(getFriendlySignupError(signUpError.message));
        return;
      }

      setConfirmation(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CreateAccountLayout supportingCopy={getSupportingCopy(nextPath)}>
      <div className="mx-auto w-full max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fcce72]/28 px-3 py-1.5 text-sm font-semibold text-[#5f4500]">
          New account
        </div>
        <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432] sm:text-4xl">
          {confirmation ? "Check your inbox" : "Create your account"}
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-[#5b605e] sm:text-base">
          {confirmation
            ? "We sent a confirmation link to your email address. Verify it first, then sign in to continue into the app."
            : "Set up your details once, confirm your email, and we will take you back to the right group or invite."}
        </p>

        {!confirmation ? (
          <form
            className="mt-8 space-y-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleSignup();
            }}
          >
            <div>
              <label htmlFor="create-account-name" className="text-sm font-semibold text-[#2e3432]">
                Your name
              </label>
              <input
                id="create-account-name"
                type="text"
                autoComplete="name"
                placeholder="Enter your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={FIELD_CLASS_NAME}
              />
            </div>

            <div>
              <label htmlFor="create-account-email" className="text-sm font-semibold text-[#2e3432]">
                Email address
              </label>
              <input
                id="create-account-email"
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

            <div>
              <label htmlFor="create-account-password" className="text-sm font-semibold text-[#2e3432]">
                Password
              </label>
              <input
                id="create-account-password"
                type="password"
                autoComplete="new-password"
                placeholder="Create a password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={FIELD_CLASS_NAME}
              />
            </div>

            <div className="rounded-[1.35rem] bg-[#f2f4f2] px-4 py-3 text-sm leading-6 text-[#5b605e]">
              Use at least {MIN_PASSWORD_LENGTH} characters. A short phrase plus a symbol or number is
              usually easier to remember and harder to guess.
            </div>

            {error ? (
              <div role="alert" className="rounded-[1.35rem] bg-[#fff1ef] px-4 py-3 text-sm leading-6 text-[#821a01]">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[linear-gradient(135deg,#48664e_0%,#3c5a43_100%)] px-6 py-4 text-base font-semibold text-[#f7fbf8] shadow-[0_24px_55px_rgba(60,90,67,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_30px_60px_rgba(60,90,67,0.24)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
            >
              {isSubmitting ? "Sending confirmation..." : "Sign up"}
            </button>

            <p className="text-center text-sm leading-6 text-[#5b605e]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
                className="font-semibold text-[#a43c3f] transition hover:text-[#812227]"
              >
                Sign in instead
              </button>
            </p>
          </form>
        ) : (
          <div className="mt-8 space-y-5">
            <div className="rounded-[1.75rem] bg-[#f2f4f2] p-5 sm:p-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#d7fadb] px-3 py-1 text-sm font-semibold text-[#43614a]">
                Account created
              </div>
              <h3 className="mt-4 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">
                Confirm your email, then sign in.
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#5b605e] sm:text-base">
                We sent a confirmation link to{" "}
                <span className="font-semibold text-[#2e3432]">{email || "your inbox"}</span>. After
                you confirm it, come back here and sign in.
              </p>
            </div>

            <div className="rounded-[1.75rem] bg-[#fff8f1] p-5 sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7b5902]">Next up</p>
              <div className="mt-3 space-y-3 text-sm leading-6 text-[#5b605e] sm:text-base">
                <p>1. Open the confirmation email.</p>
                <p>2. Sign in with the same email and password.</p>
                <p>3. We will take you to the right screen.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
              className="w-full rounded-full bg-[linear-gradient(135deg,#a43c3f_0%,#943034_100%)] px-6 py-4 text-base font-semibold text-[#fff7f6] shadow-[0_24px_55px_rgba(164,60,63,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_30px_60px_rgba(164,60,63,0.24)]"
            >
              Continue to sign in
            </button>
          </div>
        )}
      </div>
    </CreateAccountLayout>
  );
}

function CreateAccountFallback() {
  return (
    <CreateAccountLayout supportingCopy="Loading the account form so you can continue to your group or invite.">
      <div className="mx-auto w-full max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fcce72]/28 px-3 py-1.5 text-sm font-semibold text-[#5f4500]">
          New account
        </div>
        <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432] sm:text-4xl">
          Create your account
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-[#5b605e] sm:text-base">Loading account setup...</p>
      </div>
    </CreateAccountLayout>
  );
}

export default function CreateAccountPage() {
  return (
    <Suspense fallback={<CreateAccountFallback />}>
      <CreateAccountPageInner />
    </Suspense>
  );
}
