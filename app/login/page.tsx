"use client";
import Image from "next/image";
import { Suspense, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { linkUserToGroup } from "@/utils/linkUserToGroup";
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  confirm_email: "Please confirm your email address before opening the app.",
  auth_failed: "Authentication failed. Please try again.",
  no_code: "We did not receive a valid authentication code. Please try again.",
};
const FIELD_CLASS_NAME =
  "h-16 w-full rounded-[1.35rem] border border-[#d8c8af] bg-[linear-gradient(180deg,#fffefb_0%,#f7f2e8_100%)] pl-16 pr-5 text-[16px] text-[#4b4338] shadow-[inset_0_2px_5px_rgba(120,101,73,0.12),0_4px_12px_rgba(86,64,34,0.12)] outline-none transition placeholder:text-[#8b8378] focus:border-[#b6201f] focus:ring-2 focus:ring-[#b6201f]/20";
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

function rememberPostLoginNextPath(nextPath: string) {
  document.cookie = `post_login_next=${encodeURIComponent(nextPath)}; Path=/; Max-Age=1800; SameSite=Lax`;
}
function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-[#6f6a63] stroke-[1.9]"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M5.5 7.5 12 12.5l6.5-5" /></svg>
  );
}
function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-[#6f6a63] stroke-[1.9]"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8.4a4 4 0 1 1 8 0V11" /><circle cx="12" cy="16" r="1.4" fill="#6f6a63" stroke="none" /></svg>
  );
}
function GiftMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 80 80" className="h-16 w-16 drop-shadow-[0_6px_10px_rgba(96,61,16,0.25)]"><rect x="14" y="30" width="52" height="34" rx="6" fill="#2f7a3c" /><rect x="36" y="30" width="8" height="34" fill="#f6c33b" /><rect x="14" y="44" width="52" height="8" fill="#f6c33b" /><rect x="18" y="18" width="44" height="14" rx="4" fill="#d32824" /><path d="M40 18c-1-8 9-14 15-7 3 4 2 9-3 11H40V18Z" fill="#d32824" /><path d="M40 18c1-8-9-14-15-7-3 4-2 9 3 11h12V18Z" fill="#ef5645" /><circle cx="40" cy="26" r="4" fill="#f8d260" /></svg>
  );
}
function GoldStar({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}><path d="m12 2.7 2.4 5 5.5.7-4 3.9 1 5.6-5-2.6-5 2.6 1-5.6-4-3.9 5.5-.7Z" fill="#f5c84d" stroke="#c89411" strokeWidth="1" /></svg>
  );
}
function HollyCorner({ side }: { side: "left" | "right" }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute top-14 z-20 ${side === "left" ? "left-8" : "right-8 scale-x-[-1]"}`}>
      <div className="relative h-28 w-44">
        <div className="absolute left-5 top-5 h-16 w-8 rotate-[-55deg] rounded-full bg-[linear-gradient(180deg,#2d7a2e_0%,#0f4f17_100%)] shadow-[0_6px_10px_rgba(20,58,24,0.22)]" />
        <div className="absolute left-11 top-2 h-16 w-8 rotate-[-18deg] rounded-full bg-[linear-gradient(180deg,#338737_0%,#14551b_100%)] shadow-[0_6px_10px_rgba(20,58,24,0.22)]" />
        <div className="absolute left-20 top-6 h-16 w-8 rotate-[18deg] rounded-full bg-[linear-gradient(180deg,#2d7a2e_0%,#0f4f17_100%)] shadow-[0_6px_10px_rgba(20,58,24,0.22)]" />
        <div className="absolute left-0 top-12 h-10 w-10 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ff6e61_0%,#c51211_60%,#8e0a0a_100%)] shadow-[0_8px_12px_rgba(118,14,14,0.28)]" />
        <div className="absolute left-8 top-5 h-9 w-9 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ff6e61_0%,#c51211_60%,#8e0a0a_100%)] shadow-[0_8px_12px_rgba(118,14,14,0.28)]" />
        <div className="absolute left-20 top-10 h-9 w-9 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ff6e61_0%,#c51211_60%,#8e0a0a_100%)] shadow-[0_8px_12px_rgba(118,14,14,0.28)]" />
        <GoldStar className="absolute left-24 top-0 h-8 w-8 drop-shadow-[0_3px_6px_rgba(197,150,24,0.22)]" />
      </div>
    </div>
  );
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#efe6d9_0%,#e9dfd2_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="relative w-full max-w-[780px] rounded-[3rem] bg-[linear-gradient(180deg,#f8f2e7_0%,#f0e5d4_100%)] p-3 shadow-[0_30px_80px_rgba(79,50,24,0.22)]">
          <div className="relative overflow-hidden rounded-[2.6rem] border border-[#efe4d2] bg-[radial-gradient(circle_at_top,#fffdf8_0%,#f6eddc_48%,#efe4cf_100%)] px-5 pb-6 pt-6 sm:px-7">
            <div className="absolute inset-0 bg-[url('/snowflakes.png')] bg-cover bg-center opacity-[0.08] mix-blend-multiply" />
            <div className="absolute inset-x-4 top-24 bottom-20 rounded-[2rem] border-[6px] border-[#bb251f] shadow-[inset_0_0_0_2px_rgba(255,216,173,0.5),0_0_0_1px_rgba(107,14,12,0.18)] sm:inset-x-6 sm:top-28 sm:bottom-20" />
            <HollyCorner side="left" />
            <HollyCorner side="right" />
            <div className="relative z-10 text-center">
              <p className="text-[clamp(1.1rem,1.6vw,1.7rem)] font-semibold tracking-[-0.02em] text-[#7f7c78]">Sign In</p>
              <div className="mx-auto mt-3 h-px max-w-[540px] bg-[linear-gradient(90deg,transparent,#d7c7ac,transparent)]" />
            </div>
            <div className="relative z-20 mt-8 w-full pb-20 pt-20 sm:pb-24 sm:pt-24">
              <Image src="/bells-holly.png" alt="" aria-hidden="true" width={220} height={220} className="pointer-events-none absolute left-1/2 top-0 w-40 -translate-x-1/2 -translate-y-[42%] sm:w-52" />
              {children}
            </div>
            <Image src="/gifts.png" alt="" aria-hidden="true" width={220} height={220} className="pointer-events-none absolute bottom-10 left-4 z-10 w-28 drop-shadow-[0_14px_24px_rgba(88,58,23,0.2)] sm:bottom-12 sm:left-8 sm:w-40" />
            <Image src="/santa-hat.png" alt="" aria-hidden="true" width={180} height={180} className="pointer-events-none absolute bottom-14 right-3 z-10 w-24 rotate-[5deg] drop-shadow-[0_14px_24px_rgba(88,58,23,0.2)] sm:right-7 sm:w-32" />
            <div className="absolute inset-x-0 bottom-0 z-20 flex h-16 items-center justify-center gap-4 border-t border-[#deccb0] bg-[linear-gradient(180deg,#f7f0df_0%,#f0e5d0_100%)] px-4 text-sm font-semibold sm:gap-8 sm:text-[15px]" />
          </div>
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
  const nextPath = (() => { const candidate = searchParams.get("next") || "/dashboard"; return candidate.startsWith("/") ? candidate : "/dashboard"; })();
  const pageError = mapAuthErrorMessage(searchParams.get("error"), searchParams.get("message"));
  const activeError = error || pageError;
  const handleGoogleLogin = async () => {
    setError(null);
    setRedirecting(true);
    rememberPostLoginNextPath(nextPath);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    if (signInError) {
      setError(getFriendlyLoginError(signInError.message));
      setLoading(false);
      return;
    }
    if (data.user) {
      await linkUserToGroup(data.user);
    }
    router.replace(nextPath);
    setLoading(false);
  };
  return (
    <LoginShell>
      <div className="relative mx-auto max-w-[520px] text-center">
        {redirecting && (
          <div className="absolute inset-0 z-30 flex rounded-[2rem] bg-[#f7efdf]/90 backdrop-blur-sm">
            <div className="m-auto rounded-[1.7rem] bg-white/90 px-6 py-7 text-center shadow-[0_18px_42px_rgba(77,47,20,0.18)]">
              <div className="mx-auto h-11 w-11 animate-spin rounded-full border-[3px] border-[#f1d278] border-t-[#b6201f]" />
              <p className="mt-4 text-lg font-semibold text-[#4c3a2a]">Redirecting to Google</p>
            </div>
          </div>
        )}
        <div className="relative inline-flex items-center gap-3">
          <GiftMark />
          <h1 className="font-serif text-[clamp(2.4rem,5vw,4.4rem)] font-bold italic leading-none tracking-[-0.05em] text-[#b01717]">My Secret Santa</h1>
          <Image src="/santa-hat.png" alt="" aria-hidden="true" width={88} height={88} className="pointer-events-none absolute -right-2 -top-5 w-16 rotate-[12deg] sm:w-20" />
        </div>
        <p className="mt-4 text-[clamp(1.7rem,2.3vw,2.2rem)] font-semibold text-[#2d7a2e]">Welcome to Secret Santa!</p>
        <form
          className="mt-8 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleEmailLogin();
          }}
        >
          <label className="sr-only" htmlFor="login-email">Email address</label>
          <div className="relative text-left">
            <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center"><MailIcon /></span>
            <input id="login-email" type="text" autoComplete="email" inputMode="email" spellCheck={false} placeholder="Enter your username or email" value={email} onChange={(event) => setEmail(event.target.value)} className={FIELD_CLASS_NAME} />
          </div>
          <label className="sr-only" htmlFor="login-password">Password</label>
          <div className="relative text-left">
            <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center"><LockIcon /></span>
            <input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} className={FIELD_CLASS_NAME} />
          </div>
          {activeError ? (
            <div role="alert" className="rounded-[1.25rem] border border-[#e5b4ad] bg-[#fff3f1] px-4 py-3 text-left text-sm text-[#8f2417]">{activeError}</div>
          ) : null}
          <button type="submit" disabled={loading || redirecting} className="h-16 w-full rounded-[1.35rem] border border-[#a70f11] bg-[linear-gradient(180deg,#ec3d39_0%,#c41e1f_100%)] text-[1.15rem] font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.28),0_8px_20px_rgba(121,17,18,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70">{loading ? "Logging in..." : "Login"}</button>
          <div className="flex items-center gap-4 py-2 text-[#77706a]">
            <div className="h-px flex-1 bg-[#d6c8b1]" />
            <span className="text-[1rem] font-semibold">or</span>
            <div className="h-px flex-1 bg-[#d6c8b1]" />
          </div>
          <button type="button" onClick={() => void handleGoogleLogin()} disabled={loading || redirecting} className="flex h-16 w-full items-center justify-center gap-3 rounded-[1.35rem] border border-[#d6c8b1] bg-[linear-gradient(180deg,#ffffff_0%,#f0f1f4_100%)] text-[1.05rem] font-semibold text-[#272727] shadow-[inset_0_2px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(87,67,40,0.14)] transition hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-70">
            <Image src="/google-logo.png" alt="" aria-hidden="true" width={28} height={28} className="h-7 w-7" />
            <span>{redirecting ? "Redirecting..." : "Continue with Google"}</span>
          </button>
        </form>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex h-16 items-center justify-center gap-4 border-t border-[#deccb0] bg-[linear-gradient(180deg,#f7f0df_0%,#f0e5d0_100%)] px-4 text-sm font-semibold sm:gap-8 sm:text-[15px]">
        <button
          type="button"
          onClick={() => router.push(`/create-account?next=${encodeURIComponent(nextPath)}`)}
          className="pointer-events-auto text-[#2d7a2e] transition hover:text-[#17531d]"
        >
          Create Account
        </button>
        <span aria-hidden="true" className="text-[#a99b84]">|</span>
        <button
          type="button"
          onClick={() => router.push("/forgot-password")}
          className="pointer-events-auto text-[#b6201f] transition hover:text-[#8e1717]"
        >
          Forgot password?
        </button>
      </div>
    </LoginShell>
  );
}
function LoginFallback() {
  return (
    <LoginShell>
      <div className="mx-auto max-w-[520px] text-center">
        <div className="inline-flex items-center gap-3">
          <GiftMark />
          <h1 className="font-serif text-[clamp(2.4rem,5vw,4.4rem)] font-bold italic leading-none tracking-[-0.05em] text-[#b01717]">My Secret Santa</h1>
        </div>
        <p className="mt-4 text-[clamp(1.7rem,2.3vw,2.2rem)] font-semibold text-[#2d7a2e]">Loading login...</p>
      </div>
    </LoginShell>
  );
}
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageInner />
    </Suspense>
  );
}
