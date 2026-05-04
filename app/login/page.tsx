"use client";

import Image from "next/image";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  AUTH_FIELD_CLASS_NAME,
  AuthPageFrame,
} from "@/app/components/AuthPageShell";
import { OAUTH_CALLBACK_FAILED_ERROR } from "@/lib/auth/oauth-callback-errors";
import { normalizeSafeAppPath } from "@/lib/security/safe-app-path";
import { createClient } from "@/lib/supabase/client";

const LOGIN_FEATURES = [
  {
    title: "Groups and invites",
    copy: "Every exchange in one calm place.",
  },
  {
    title: "Recipient reveal",
    copy: "Covered until the draw is ready.",
  },
  {
    title: "Wishlist hints",
    copy: "Ready for thoughtful gifts.",
  },
] as const;

const LOGIN_HERO_BACKGROUND_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(145deg, rgba(255,253,246,0.98), rgba(247,250,244,0.94))",
};

const LOGIN_FORM_BACKGROUND_STYLE: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at 18% 0%, rgba(216,169,69,0.12), transparent 32%), radial-gradient(circle at 100% 100%, rgba(164,60,63,0.08), transparent 34%)",
};

const LOGIN_TAG_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(145deg, rgba(255,255,251,0.96) 0%, #fff0c4 64%, #ffe7a8 100%)",
  borderRadius: "1.875rem 1.875rem 1.875rem 4.5rem",
  transform: "rotate(-1.2deg)",
  transformOrigin: "center center",
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  confirm_email: "Please confirm your email address before signing in.",
  auth_failed: "We could not sign you in. Please try again.",
  no_code: "The sign-in link did not work. Please try again.",
  [OAUTH_CALLBACK_FAILED_ERROR]: "Google sign-in expired. Please start again.",
};

const GENERIC_LOGIN_ERROR =
  "We could not sign you in. Please check your email and password, then try again.";
const GOOGLE_OAUTH_UNAVAILABLE_ERROR =
  "Google sign-in did not open. Please try again or sign in with email.";
const OAUTH_REDIRECT_HELP_DELAY_MS = 8000;

function getReadableAuthErrorMessage(message: string | null): string | null {
  const trimmedMessage = message?.trim();

  if (!trimmedMessage) {
    return null;
  }

  const looksLikeRawJson =
    (trimmedMessage.startsWith("{") && trimmedMessage.endsWith("}")) ||
    (trimmedMessage.startsWith("[") && trimmedMessage.endsWith("]"));

  if (!looksLikeRawJson) {
    return trimmedMessage === "[object Object]" ? null : trimmedMessage;
  }

  try {
    const parsedValue: unknown = JSON.parse(trimmedMessage);

    if (parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)) {
      const parsedRecord = parsedValue as Record<string, unknown>;
      const parsedMessage =
        parsedRecord.message || parsedRecord.error_description || parsedRecord.error;

      return typeof parsedMessage === "string" && parsedMessage.trim()
        ? parsedMessage.trim()
        : null;
    }
  } catch {
    return null;
  }

  return null;
}

function mapAuthErrorMessage(errorCode: string | null, message: string | null): string | null {
  return getReadableAuthErrorMessage(message) || (errorCode ? AUTH_ERROR_MESSAGES[errorCode] || null : null);
}

function getFriendlyLoginError(message: string): string {
  const readableMessage = getReadableAuthErrorMessage(message);

  if (!readableMessage) {
    return GENERIC_LOGIN_ERROR;
  }

  const normalized = readableMessage.toLowerCase();

  return normalized.includes("invalid login credentials")
    ? "We could not match that email and password. Please try again."
    : normalized.includes("email not confirmed")
      ? "Please confirm your email before signing in."
      : readableMessage;
}

function getSupportingCopy(nextPath: string): string {
  return nextPath !== "/dashboard"
    ? "Log in to open the page you requested."
    : "Open your groups, wishlist, recipient details, and private gift messages from one account.";
}

function rememberPostLoginNextPath(nextPath: string) {
  document.cookie = `post_login_next=${encodeURIComponent(nextPath)}; Path=/; Max-Age=1800; SameSite=Lax`;
}

function AuthHeading({ description }: { description: string }) {
  return (
    <>
      <h1 className="text-center font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.055em] text-[#334d39] sm:text-5xl lg:text-left">
        Log in
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-[15px] font-semibold leading-7 text-[#5b605e] sm:text-base lg:mx-0 lg:text-left">
        {description}
      </p>
    </>
  );
}

function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <AuthPageFrame gridClassName="lg:grid-cols-[1.08fr_0.92fr]" showDecorativeBlobs={false}>
      <LoginGiftTagHero />

      <section
        className="flex items-center rounded-[1.9rem] bg-white/95 px-5 py-8 sm:px-8 sm:py-9 lg:px-10 lg:py-10"
        style={LOGIN_FORM_BACKGROUND_STYLE}
      >
        {children}
      </section>
    </AuthPageFrame>
  );
}

function OfficialSantaMark({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="10 5 140 145" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="login-official-santa-hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e74c3c" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="82" r="50" fill="#fde8e8" />
      <ellipse cx="80" cy="108" rx="38" ry="24" fill="#fff" />
      <ellipse cx="80" cy="102" rx="32" ry="16" fill="#fff" />
      <ellipse cx="66" cy="86" rx="12" ry="6" fill="#fff" />
      <ellipse cx="94" cy="86" rx="12" ry="6" fill="#fff" />
      <circle cx="80" cy="76" r="5" fill="#e8a8a8" />
      <circle cx="78" cy="74" r="2" fill="#f0baba" opacity=".6" />
      <ellipse cx="64" cy="66" rx="5" ry="6" fill="#fff" />
      <ellipse cx="64" cy="67" rx="4" ry="5" fill="#2c1810" />
      <circle cx="62" cy="65" r="1.8" fill="#fff" />
      <path d="M90 66 Q96 60 102 66" fill="none" stroke="#2c1810" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M54 58 Q64 51 74 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M86 58 Q96 51 106 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="52" cy="78" rx="7" ry="5" fill="#f0a0a0" opacity=".3" />
      <ellipse cx="108" cy="78" rx="7" ry="5" fill="#f0a0a0" opacity=".3" />
      <rect x="76" y="84" width="9" height="26" rx="4.5" fill="#f8d0d0" stroke="#e8b8b8" strokeWidth=".8" />
      <ellipse cx="80.5" cy="85" rx="3.5" ry="2.5" fill="#fce4e4" />
      <path d="M32 58 C32 58 50 14 82 10 C114 6 128 58 128 58" fill="url(#login-official-santa-hat)" />
      <rect x="26" y="54" width="108" height="10" rx="5" fill="#fff" />
      <circle cx="86" cy="10" r="8" fill="#fff" />
    </svg>
  );
}

function OfficialSantaLogo() {
  return (
    <div className="flex items-center gap-3">
      <OfficialSantaMark className="h-13 w-13 shrink-0" />
      <div className="leading-[1.08]">
        <span className="block text-[14px] font-black text-[#c0392b]">My Secret</span>
        <span className="block font-[Plus_Jakarta_Sans] text-[25px] font-black tracking-[-0.04em] text-[#1a1a1a]">
          Santa
        </span>
        <span className="mt-0.5 block text-[10px] font-black italic text-[#c0392b]">
          shhh... it&apos;s a secret!
        </span>
      </div>
    </div>
  );
}

function LoginGiftTagHero() {
  return (
    <section
      className="relative overflow-hidden rounded-[1.9rem] bg-[#fbfcfa] px-5 py-7 shadow-[0_24px_60px_rgba(46,52,50,0.05)] ring-1 ring-[#48664e]/10 sm:px-8 sm:py-8 lg:px-10 lg:py-10"
      style={LOGIN_HERO_BACKGROUND_STYLE}
      aria-label="Secret Santa login preview"
    >
      <div className="relative z-10">
        <OfficialSantaLogo />

        <div className="relative mt-7">
          <div
            className="relative mx-auto max-w-147 border border-[#7a5802]/20 px-5 py-5 shadow-[0_28px_68px_rgba(123,89,2,0.16),0_18px_34px_rgba(72,102,78,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] sm:px-8 sm:py-6"
            style={LOGIN_TAG_STYLE}
          >
            <div className="absolute right-5 top-5 h-7 w-7 rounded-full bg-[#f8faf3] shadow-[inset_0_2px_8px_rgba(46,52,50,0.08)] ring-1 ring-[#7a5802]/20" />

            <div className="inline-flex items-center gap-2 rounded-full border border-[#7a5802]/10 bg-white/75 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#735400]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#a43c3f] shadow-[0_0_0_4px_rgba(164,60,63,0.11)]" />
              Secret Santa pass
            </div>

            <h2 className="mt-4 max-w-124 font-serif text-[2.1rem] font-black leading-[0.94] tracking-[-0.055em] text-[#2e3432] sm:text-[2.55rem]">
              The best gifts start with a little mystery.
            </h2>
            <p className="mt-3 max-w-126 text-sm font-extrabold leading-6 text-[#5d665f]">
              Plan the exchange, collect wishlists, and keep names private until the draw is ready.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[#d8a945]/50 pt-3 sm:grid-cols-3">
              {["Names stay secret", "Reveal on draw day", "Gift hints ready"].map((label) => (
                <span
                  key={label}
                  className="inline-flex min-h-7 items-center justify-center rounded-full border border-[#7a5802]/10 bg-white/50 px-3 py-1.5 text-center text-[11px] font-black leading-tight text-[#735400]"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto mt-2 w-full max-w-124">
            <div className="absolute inset-x-10 bottom-4 h-16 rounded-full bg-[#2e3432]/10 blur-2xl" />
            <Image
              src="/secret-santa-gifts-cropped.png"
              alt="Wrapped Christmas gifts"
              width={964}
              height={395}
              priority
              className="relative mx-auto h-auto w-full max-w-124 select-none"
            />
          </div>
        </div>

        <div className="relative mt-4 rounded-[1.55rem] border border-[#48664e]/10 bg-white/90 p-3 shadow-[0_16px_34px_rgba(46,52,50,0.08)]">
          <div className="grid gap-3 sm:grid-cols-3">
            {LOGIN_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-[1.05rem] bg-[#eef4ef] px-3 py-3">
                <p className="text-[13px] font-black text-[#334d39]">{feature.title}</p>
                <p className="mt-1 text-[12px] font-extrabold leading-5 text-[#2e3432]">
                  {feature.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const oauthAttemptLeftPageRef = useRef(false);
  const oauthAttemptIdRef = useRef(0);
  const oauthRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [showOauthHelp, setShowOauthHelp] = useState(false);

  const nextPath = (() => {
    const candidate = searchParams.get("next") || "/dashboard";
    return normalizeSafeAppPath(candidate, "/dashboard");
  })();

  const pageError = mapAuthErrorMessage(searchParams.get("error"), searchParams.get("message"));
  const activeError = error || pageError;

  const clearOauthRecoveryTimer = () => {
    if (!oauthRecoveryTimerRef.current) {
      return;
    }

    clearTimeout(oauthRecoveryTimerRef.current);
    oauthRecoveryTimerRef.current = null;
  };

  const resetGoogleRedirectState = () => {
    clearOauthRecoveryTimer();
    setRedirecting(false);
    setOauthUrl(null);
    setShowOauthHelp(false);
  };

  useEffect(() => {
    const clearRedirectState = () => {
      if (!oauthAttemptLeftPageRef.current) {
        return;
      }

      oauthAttemptLeftPageRef.current = false;
      oauthAttemptIdRef.current += 1;
      if (oauthRecoveryTimerRef.current) {
        clearTimeout(oauthRecoveryTimerRef.current);
        oauthRecoveryTimerRef.current = null;
      }
      setRedirecting(false);
      setOauthUrl(null);
      setShowOauthHelp(false);
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

  useEffect(() => {
    return () => {
      if (oauthRecoveryTimerRef.current) {
        clearTimeout(oauthRecoveryTimerRef.current);
        oauthRecoveryTimerRef.current = null;
      }
    };
  }, []);

  const cancelGoogleRedirect = () => {
    oauthAttemptIdRef.current += 1;
    window.stop();
    resetGoogleRedirectState();
  };

  const handleGoogleLogin = async () => {
    if (loading || redirecting) {
      return;
    }

    const attemptId = oauthAttemptIdRef.current + 1;
    oauthAttemptIdRef.current = attemptId;
    setError(null);
    setOauthUrl(null);
    setShowOauthHelp(false);
    setRedirecting(true);
    rememberPostLoginNextPath(nextPath);
    clearOauthRecoveryTimer();
    oauthRecoveryTimerRef.current = setTimeout(() => {
      if (oauthAttemptIdRef.current === attemptId) {
        window.stop();
        setShowOauthHelp(true);
      }
    }, OAUTH_REDIRECT_HELP_DELAY_MS);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });

      if (oauthAttemptIdRef.current !== attemptId) {
        return;
      }

      if (signInError) {
        resetGoogleRedirectState();
        setError(getFriendlyLoginError(signInError.message));
        return;
      }

      if (!data.url) {
        resetGoogleRedirectState();
        setError(GOOGLE_OAUTH_UNAVAILABLE_ERROR);
        return;
      }

      setOauthUrl(data.url);
      window.location.assign(data.url);
    } catch {
      if (oauthAttemptIdRef.current !== attemptId) {
        return;
      }

      resetGoogleRedirectState();
      setError(GOOGLE_OAUTH_UNAVAILABLE_ERROR);
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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      setError(getFriendlyLoginError(signInError.message));
      setLoading(false);
      return;
    }

    router.replace(nextPath);
    setLoading(false);
  };

  return (
    <LoginLayout>
      <div className="relative mx-auto w-full max-w-xl">
        {redirecting && (
          <div className="absolute inset-0 z-50 flex rounded-[1.9rem] bg-[#f9faf8]/92 backdrop-blur-sm">
            <div className="m-auto flex max-w-xs flex-col items-center rounded-[1.75rem] bg-white px-6 py-7 text-center shadow-[0_24px_55px_rgba(46,52,50,0.1)]">
              <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-[#d7fadb] border-t-[#48664e]" />
              <p className="mt-4 font-[Plus_Jakarta_Sans] text-xl font-black tracking-[-0.04em] text-[#2e3432]">
                Opening Google sign-in
              </p>
              <p className="mt-2 text-sm leading-6 text-[#5b605e]">
                Hold on for a moment while we open the secure sign-in flow.
              </p>
              {showOauthHelp ? (
                <div className="mt-5 w-full rounded-[1.25rem] bg-[#fff8e6] px-4 py-3 text-sm leading-6 text-[#6f4a00]">
                  <p className="font-semibold text-[#4d3500]">Still on this screen?</p>
                  <p className="mt-1">
                    Google sign-in is taking longer than expected. You can try opening it again or
                    return to the form.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {oauthUrl ? (
                      <a
                        href={oauthUrl}
                        className="rounded-full bg-[#48664e] px-4 py-2 font-semibold text-white transition hover:bg-[#3c5a43]"
                      >
                        Open Google sign-in again
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={cancelGoogleRedirect}
                      className="rounded-full bg-white px-4 py-2 font-semibold text-[#48664e] ring-1 ring-[#d8dfd7] transition hover:bg-[#f7faf7]"
                    >
                      Back to sign in
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <AuthHeading description={getSupportingCopy(nextPath)} />

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
            {loading ? "Logging in..." : "Log in"}
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
    <LoginLayout>
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
