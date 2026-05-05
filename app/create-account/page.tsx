"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AUTH_FIELD_CLASS_NAME,
  AuthHeroPanel,
  AuthPageFrame,
} from "@/app/components/AuthPageShell";
import { getPasswordPolicyMessage, PASSWORD_POLICY_HELP_TEXT } from "@/lib/auth/password-policy";
import { normalizeSafeAppPath } from "@/lib/security/safe-app-path";
import { createClient } from "@/lib/supabase/client";

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

  if (normalized.includes("weak password") || normalized.includes("password is too weak")) {
    return PASSWORD_POLICY_HELP_TEXT;
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
    <AuthPageFrame gridClassName="lg:grid-cols-[1.06fr_0.94fr]">
      <AuthHeroPanel
        badge="New account"
        title="Join your Secret Santa group."
        titleAs="h1"
        titleClassName="lg:text-[3.4rem]"
        description="Create an account so you can join groups, add wishlist ideas, and see your Secret Santa details when names are drawn."
        supportingCopy={supportingCopy}
        detailEyebrow="Before names are drawn"
        detailTitle="Add gift ideas now so your Santa has helpful clues later."
        detailTitleAs="h2"
        markers={TRUST_MARKERS}
        imageSize={144}
        showBottomAccent
      />

      <section className="rounded-[1.9rem] bg-white px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        {children}
      </section>
    </AuthPageFrame>
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
  const [formReady, setFormReady] = useState(false);

  const nextPath = (() => {
    const candidate = searchParams.get("next") || "/dashboard";
    return normalizeSafeAppPath(candidate, "/dashboard");
  })();

  const rememberNextPath = () => {
    document.cookie = `post_login_next=${encodeURIComponent(nextPath)}; Path=/; Max-Age=86400; SameSite=Lax`;
  };

  useEffect(() => {
    const formReadyTimer = window.setTimeout(() => setFormReady(true), 0);
    return () => window.clearTimeout(formReadyTimer);
  }, []);

  const handleSignup = async () => {
    if (!formReady || isSubmitting) {
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

    const passwordPolicyMessage = getPasswordPolicyMessage(password);
    if (passwordPolicyMessage) {
      setError(passwordPolicyMessage);
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
        <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-tighter text-[#2e3432] sm:text-4xl">
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
                disabled={!formReady || isSubmitting}
                className={AUTH_FIELD_CLASS_NAME}
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
                disabled={!formReady || isSubmitting}
                className={AUTH_FIELD_CLASS_NAME}
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
                disabled={!formReady || isSubmitting}
                className={AUTH_FIELD_CLASS_NAME}
              />
            </div>

            <div className="rounded-[1.35rem] bg-[#f2f4f2] px-4 py-3 text-sm leading-6 text-[#5b605e]">
              {PASSWORD_POLICY_HELP_TEXT} A short phrase is usually easier to remember and harder
              to guess.
            </div>

            {error ? (
              <div role="alert" className="rounded-[1.35rem] bg-[#fff1ef] px-4 py-3 text-sm leading-6 text-[#821a01]">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!formReady || isSubmitting}
              className="w-full rounded-full bg-[linear-gradient(135deg,#48664e_0%,#3c5a43_100%)] px-6 py-4 text-base font-semibold text-[#f7fbf8] shadow-[0_24px_55px_rgba(60,90,67,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_30px_60px_rgba(60,90,67,0.24)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
            >
              {isSubmitting ? "Sending confirmation..." : "Sign up"}
            </button>

            <p className="text-center text-xs leading-5 text-[#6a706d]">
              By creating an account, you agree to how My Secret Santa handles your data in the{" "}
              <a href="/privacy" className="font-semibold text-[#a43c3f] transition hover:text-[#812227]">
                Privacy Policy
              </a>
              .
            </p>

            <p className="text-center text-sm leading-6 text-[#5b605e]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
                disabled={!formReady || isSubmitting}
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
        <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-tighter text-[#2e3432] sm:text-4xl">
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
