"use client";

import Image from "next/image";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  AUTH_FIELD_CLASS_NAME,
  AuthHeroPanel,
  AuthPageFrame,
} from "@/app/components/AuthPageShell";
import { createClient } from "@/lib/supabase/client";
import { linkUserToGroup } from "@/utils/linkUserToGroup";

const TRUST_MARKERS = [
  {
    title: "Private group details",
    copy: "Your wishlist, recipient, chat, and group details stay inside your account.",
  },
  {
    title: "Email or Google sign-in",
    copy: "Use your email and password, or continue with Google.",
  },
  {
    title: "Everything in one place",
    copy: "Open your dashboard, groups, invites, and notifications with the same account.",
  },
] as const;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  confirm_email: "Please confirm your email address before signing in.",
  auth_failed: "We could not sign you in. Please try again.",
  no_code: "The sign-in link did not work. Please try again.",
};

function mapAuthErrorMessage(errorCode: string | null, message: string | null): string | null {
  return message || (errorCode ? AUTH_ERROR_MESSAGES[errorCode] || null : null);
}

function getFriendlyLoginError(message: string): string {
  const normalized = message.toLowerCase();

  return normalized.includes("invalid login credentials")
    ? "We could not match that email and password. Please try again."
    : normalized.includes("email not confirmed")
      ? "Please confirm your email before signing in."
      : message || "We could not sign you in. Please try again.";
}

function getSupportingCopy(nextPath: string): string {
  return nextPath !== "/dashboard"
    ? "Sign in to open the page you requested."
    : "Sign in to see your groups, wishlist, messages, and gift planning tools.";
}

function rememberPostLoginNextPath(nextPath: string) {
  document.cookie = `post_login_next=${encodeURIComponent(nextPath)}; Path=/; Max-Age=1800; SameSite=Lax`;
}

function AuthHeading({ description }: { description: string }) {
  return (
    <>
      <h1 className="font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432] sm:text-4xl">
        My Secret Santa
      </h1>
      <h2 className="mt-2 text-center font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#48664e] sm:text-[2rem] lg:text-left">
        Login
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-[#5b605e] sm:text-base">{description}</p>
    </>
  );
}

function LoginLayout({ children, supportingCopy }: { children: ReactNode; supportingCopy: string }) {
  return (
    <AuthPageFrame>
      <AuthHeroPanel
        badge="Secure sign-in"
        title="Sign in to your account."
        description="Open your groups, wishlist, recipient details, and private gift messages from one account."
        supportingCopy={supportingCopy}
        detailEyebrow="What you can open"
        detailTitle="Your Secret Santa details stay together after you sign in."
        markers={TRUST_MARKERS}
      />

      <section className="rounded-[1.9rem] bg-white px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        {children}
      </section>
    </AuthPageFrame>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const oauthAttemptLeftPageRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const nextPath = (() => {
    const candidate = searchParams.get("next") || "/dashboard";
    return candidate.startsWith("/") ? candidate : "/dashboard";
  })();

  const pageError = mapAuthErrorMessage(searchParams.get("error"), searchParams.get("message"));
  const activeError = error || pageError;

  useEffect(() => {
    const clearRedirectState = () => {
      if (!oauthAttemptLeftPageRef.current) {
        return;
      }

      oauthAttemptLeftPageRef.current = false;
      setRedirecting(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        oauthAttemptLeftPageRef.current = true;
        return;
      }

      if (document.visibilityState === "visible") {
        clearRedirectState();
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        clearRedirectState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setRedirecting(true);
    rememberPostLoginNextPath(nextPath);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setRedirecting(false);
      setError(getFriendlyLoginError(signInError.message));
    }
  };

  const handleEmailLogin = async () => {
    if (loading || redirecting) {
      return;
    }

    const trimmedEmail = email.trim();
    setError(null);
    rememberPostLoginNextPath(nextPath);

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      setError(getFriendlyLoginError(signInError.message));
      setLoading(false);
      return;
    }

    const { user } = data;
    if (user) {
      await linkUserToGroup(user);
    }

    router.replace(nextPath);
    setLoading(false);
  };

  return (
    <LoginLayout supportingCopy={getSupportingCopy(nextPath)}>
      <div className="relative mx-auto w-full max-w-xl">
        {redirecting && (
          <div className="absolute inset-0 z-50 flex rounded-[1.9rem] bg-[#f9faf8]/92 backdrop-blur-sm">
            <div className="m-auto flex max-w-xs flex-col items-center rounded-[1.75rem] bg-white px-6 py-7 text-center shadow-[0_24px_55px_rgba(46,52,50,0.1)]">
              <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-[#d7fadb] border-t-[#48664e]" />
              <p className="mt-4 font-[Plus_Jakarta_Sans] text-xl font-black tracking-[-0.04em] text-[#2e3432]">
                Redirecting to Google
              </p>
              <p className="mt-2 text-sm leading-6 text-[#5b605e]">
                Hold on for a moment while we open the secure sign-in flow.
              </p>
            </div>
          </div>
        )}

        <AuthHeading description="Use your account to access your groups, wishlist, notifications, and gift planning tools." />

        <form
          className="mt-8 space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleEmailLogin();
          }}
        >
          <div>
            <label htmlFor="login-email" className="text-sm font-semibold text-[#2e3432]">
              Email address
            </label>
            <input
              id="login-email"
              type="text"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              placeholder="Enter your email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={AUTH_FIELD_CLASS_NAME}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="login-password" className="text-sm font-semibold text-[#2e3432]">
                Password
              </label>
              <button
                type="button"
                onClick={() => router.push("/forgot-password")}
                className="text-sm font-semibold text-[#a43c3f] transition hover:text-[#812227]"
              >
                Forgot password?
              </button>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={AUTH_FIELD_CLASS_NAME}
            />
          </div>

          {activeError ? (
            <div
              role="alert"
              className="rounded-[1.35rem] bg-[#fff1ef] px-4 py-3 text-sm leading-6 text-[#821a01]"
            >
              {activeError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || redirecting}
            className="w-full rounded-full bg-[linear-gradient(135deg,#a43c3f_0%,#943034_100%)] px-6 py-4 text-base font-semibold text-[#fff7f6] shadow-[0_24px_55px_rgba(164,60,63,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_30px_60px_rgba(164,60,63,0.24)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-[#dfe4e1]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#777c7a]">
              Or use
            </span>
            <div className="h-px flex-1 bg-[#dfe4e1]" />
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleLogin()}
            disabled={loading || redirecting}
            className="flex w-full items-center justify-center gap-3 rounded-3xl bg-[#f2f4f2] px-5 py-4 text-base font-semibold text-[#2e3432] shadow-[0_16px_35px_rgba(46,52,50,0.06)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_24px_48px_rgba(46,52,50,0.1)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
          >
            <Image src="/google-logo.svg" alt="Google" width={24} height={24} />
            <span>{redirecting ? "Redirecting..." : "Continue with Google"}</span>
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[#5b605e]">Need an account?</p>
            <button
              type="button"
              onClick={() => router.push(`/create-account?next=${encodeURIComponent(nextPath)}`)}
              className="rounded-full bg-[linear-gradient(135deg,#48664e_0%,#3c5a43_100%)] px-5 py-3 text-sm font-semibold text-[#f7fbf8] shadow-[0_18px_38px_rgba(60,90,67,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_46px_rgba(60,90,67,0.24)]"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </LoginLayout>
  );
}

function LoginFallback() {
  return (
    <LoginLayout supportingCopy="Loading the sign-in screen.">
      <div className="mx-auto w-full max-w-xl">
        <AuthHeading description="Loading the sign-in screen..." />
      </div>
    </LoginLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageInner />
    </Suspense>
  );
}
