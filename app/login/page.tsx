"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { linkUserToGroup } from "@/utils/linkUserToGroup";

function mapAuthErrorMessage(errorCode: string | null, message: string | null): string | null {
  if (message) {
    return message;
  }

  if (!errorCode) {
    return null;
  }

  switch (errorCode) {
    case "confirm_email":
      return "Please confirm your email address before opening the app.";
    case "auth_failed":
      return "Authentication failed. Please try again.";
    case "no_code":
      return "We did not receive a valid authentication code. Please try again.";
    default:
      return null;
  }
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

  // Keep the desired post-login destination in a short-lived cookie so the
  // OAuth callback can return the user to an invite link or other deep page.
  const rememberNextPath = () => {
    document.cookie = `post_login_next=${encodeURIComponent(nextPath)}; Path=/; Max-Age=1800; SameSite=Lax`;
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setRedirecting(true);
    rememberNextPath();

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setRedirecting(false);
      setError(signInError.message);
    }
  };

  const handleEmailLogin = async () => {
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
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
    <div className="relative flex min-h-screen items-center justify-center bg-[url('/snowflakes.png')] bg-cover bg-center px-4 py-16 sm:px-6">
      {redirecting && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mb-4" />
          <p className="text-lg font-semibold text-blue-700">Redirecting to Google...</p>
        </div>
      )}

      <div className="relative w-full max-w-md rounded-lg border-4 border-white bg-gradient-to-br from-white via-blue-100 to-gray-200 p-5 shadow-xl ring-4 ring-blue-200 sm:p-8">
        <Image
          src="/bells-holly.png"
          alt="Bells Holly"
          width={128}
          height={128}
          className="absolute -top-10 left-1/2 w-20 -translate-x-1/2 transform animate-bounce sm:-top-12 sm:w-24"
        />

        <h1 className="mb-2 text-center text-2xl font-bold text-blue-900 drop-shadow-lg sm:text-3xl">
          GiftDraw
        </h1>
        <p className="mb-6 text-center text-sm text-gray-700 sm:text-base">Welcome to Secret Santa!</p>

        <input
          type="text"
          placeholder="Enter your username or email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border-2 border-blue-600 rounded-md p-3 mb-4 focus:ring-2 focus:ring-blue-400 bg-white text-black placeholder-gray-600 shadow-sm"
        />

        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border-2 border-blue-600 rounded-md p-3 mb-6 focus:ring-2 focus:ring-blue-400 bg-white text-black placeholder-gray-600 shadow-sm"
        />

        <button
          onClick={handleEmailLogin}
          disabled={loading || redirecting}
          className={`w-full font-semibold py-3 rounded-md transition ${
            loading || redirecting
              ? "bg-gray-400 cursor-not-allowed text-white"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {(error || pageError) && (
          <p className="text-red-600 text-sm mt-2">{error || pageError}</p>
        )}

        <div className="text-center text-gray-700 my-4">or</div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading || redirecting}
          className={`w-full flex items-center justify-center border border-gray-300 py-3 rounded-md transition shadow-sm ${
            loading || redirecting
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Image
            src="/google-logo.png"
            alt="Google"
            width={24}
            height={24}
            className="mr-3"
          />
          <span className="text-base font-medium">
            {redirecting ? "Redirecting..." : "Continue with Google"}
          </span>
        </button>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => router.push(`/create-account?next=${encodeURIComponent(nextPath)}`)}
            disabled={loading || redirecting}
            className={`w-full flex-1 rounded-md py-2 text-center font-medium shadow transition ${
              loading || redirecting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {loading || redirecting ? "Please wait..." : "Create Account"}
          </button>
          <button
            onClick={() => router.push("/forgot-password")}
            disabled={loading || redirecting}
            className={`w-full flex-1 rounded-md py-2 text-center font-medium shadow transition ${
              loading || redirecting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            {loading || redirecting ? "Please wait..." : "Forgot Password?"}
          </button>
        </div>

        <Image
          src="/gifts.png"
          alt="Gift Box"
          width={128}
          height={128}
          className="absolute -bottom-10 left-4 hidden w-20 animate-pulse md:-bottom-12 md:left-6 md:block md:w-28"
        />
        <Image
          src="/santa-hat.png"
          alt="Santa Hat"
          width={128}
          height={128}
          className="absolute -bottom-10 right-4 hidden w-20 animate-wiggle md:-bottom-12 md:right-6 md:block md:w-28"
        />
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[url('/snowflakes.png')] bg-cover bg-center px-4 py-16 sm:px-6">
      <div className="relative w-full max-w-md rounded-lg border-4 border-white bg-gradient-to-br from-white via-blue-100 to-gray-200 p-6 shadow-xl ring-4 ring-blue-200 sm:p-8">
        <h1 className="mb-2 text-center text-2xl font-bold text-blue-900 drop-shadow-lg sm:text-3xl">
          GiftDraw
        </h1>
        <p className="text-center text-gray-700">Loading login...</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageInner />
    </Suspense>
  );
}
