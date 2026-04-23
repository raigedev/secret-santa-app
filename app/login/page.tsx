"use client";

import Image from "next/image";
import { Suspense, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { linkUserToGroup } from "@/utils/linkUserToGroup";

const TRUST_MARKERS = [
  {
    title: "Protected account access",
    copy: "Wishlists, draw results, anonymous chat, and group details stay behind your signed-in account.",
  },
  {
    title: "Email or Google sign-in",
    copy: "Use your email and password or continue with Google from the same screen.",
  },
  {
    title: "Groups and invites",
    copy: "One login covers your dashboard, group pages, invite links, and notifications.",
  },
] as const;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  confirm_email: "Please confirm your email address before opening the app.",
  auth_failed: "Authentication failed. Please try again.",
  no_code: "We did not receive a valid authentication code. Please try again.",
};

const FIELD_CLASS_NAME =
  "mt-2 w-full rounded-[1.5rem] bg-[#e5e9e6] px-4 py-3.5 text-[15px] text-[#2e3432] outline outline-1 outline-[#aeb3b1]/30 transition placeholder:text-[#777c7a] focus:bg-white focus:outline-[#a43c3f]/35 focus:outline-2 focus:outline-offset-0 focus:outline";

function mapAuthErrorMessage(errorCode: string | null, message: string | null): string | null {
  return message || (errorCode ? AUTH_ERROR_MESSAGES[errorCode] || null : null);
}

function getFriendlyLoginError(message: string): string {
  const normalized = message.toLowerCase();

  return normalized.includes("invalid login credentials")
    ? "We could not match that email and password. Please try again."
    : normalized.includes("email not confirmed")
      ? "Please confirm your email before signing in."
      : message || "Login failed. Please try again.";
}

function getSupportingCopy(nextPath: string): string {
  return nextPath !== "/dashboard"
    ? "Sign in to open the page you requested."
    : "Use your account to access wishlists, groups, notifications, and gift planning tools.";
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
      <h2 className="mt-2 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#48664e] sm:text-[2rem]">
        Login
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-[#5b605e] sm:text-base">{description}</p>
    </>
  );
}

function LoginLayout({ children, supportingCopy }: { children: ReactNode; supportingCopy: string }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f9faf8] px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(252,206,114,0.32),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(164,60,63,0.16),_transparent_32%),linear-gradient(180deg,_#fbfcfa_0%,_#f2f4f2_100%)]" />
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] bg-cover bg-center opacity-10" />
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
                  Secure sign in
                </div>
                <h2 className="mt-6 max-w-xl font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.06em] text-[#2e3432] sm:text-5xl lg:text-[3.3rem] lg:leading-[1.02]">
                  Sign in to your account.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#5b605e] sm:text-lg">
                  Access wishlists, group details, draw results, and private gifting tools from one
                  account.
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
                      Account features
                    </p>
                    <h3 className="mt-2 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.05em] text-[#2e3432]">
                      Wishlists, groups, draws, and private chat live behind one login.
                    </h3>
                  </div>
                  <Image
                    src="/bells-holly.png"
                    alt="Holiday greenery"
                    width={160}
                    height={160}
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

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

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

        <AuthHeading description="Use your account to access wishlists, group details, notifications, and gift-planning tools." />

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
              placeholder="Enter your username or email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={FIELD_CLASS_NAME}
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
              className={FIELD_CLASS_NAME}
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
              Or continue with
            </span>
            <div className="h-px flex-1 bg-[#dfe4e1]" />
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleLogin()}
            disabled={loading || redirecting}
            className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-[#f2f4f2] px-5 py-4 text-base font-semibold text-[#2e3432] shadow-[0_16px_35px_rgba(46,52,50,0.06)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_24px_48px_rgba(46,52,50,0.1)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
          >
            <Image src="/google-logo.png" alt="Google" width={24} height={24} />
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
        <AuthHeading description="Loading login..." />
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
