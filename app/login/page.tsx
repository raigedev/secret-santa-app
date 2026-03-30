"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { linkUserToGroup } from "@/utils/linkUserToGroup";

export default function LoginPage() {
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
      console.error("Google login error:", signInError.message);
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
    <div className="min-h-screen flex items-center justify-center bg-[url('/snowflakes.png')] bg-cover bg-center relative">
      {redirecting && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mb-4" />
          <p className="text-lg font-semibold text-blue-700">Redirecting to Google...</p>
        </div>
      )}

      <div className="bg-gradient-to-br from-white via-blue-100 to-gray-200 rounded-lg shadow-xl border-4 border-white p-8 max-w-md w-full relative ring-4 ring-blue-200">
        <Image
          src="/bells-holly.png"
          alt="Bells Holly"
          width={128}
          height={128}
          className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-24 animate-bounce"
        />

        <h1 className="text-3xl font-bold text-center mb-2 text-blue-900 drop-shadow-lg">
          GiftDraw
        </h1>
        <p className="text-center text-gray-700 mb-6">Welcome to Secret Santa!</p>

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

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

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

        <div className="flex justify-between mt-6">
          <button
            onClick={() => router.push(`/create-account?next=${encodeURIComponent(nextPath)}`)}
            disabled={loading || redirecting}
            className={`w-[48%] text-center py-2 rounded-md transition font-medium shadow ${
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
            className={`w-[48%] text-center py-2 rounded-md transition font-medium shadow ${
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
          className="absolute -bottom-12 left-6 w-28 animate-pulse"
        />
        <Image
          src="/santa-hat.png"
          alt="Santa Hat"
          width={128}
          height={128}
          className="absolute -bottom-12 right-6 w-28 animate-wiggle"
        />
      </div>
    </div>
  );
}
