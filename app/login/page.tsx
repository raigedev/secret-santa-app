"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // ✅ Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session && window.location.pathname === "/login") {
        router.push("/dashboard");
      }
    };
    checkSession();

    // ✅ Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session && window.location.pathname === "/login") {
          router.push("/dashboard");
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const handleGoogleLogin = async () => {
    setRedirecting(true); // show overlay immediately
    // Small delay so overlay renders before redirect
    setTimeout(async () => {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    }, 100);
  };

  const handleEmailLogin = async () => {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('/snowflakes.png')] bg-cover bg-center relative">
      {/* Redirecting overlay */}
      {redirecting && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mb-4"></div>
          <p className="text-lg font-semibold text-blue-700">Redirecting to Google…</p>
        </div>
      )}

      <div className="bg-gradient-to-br from-white via-blue-100 to-gray-200 rounded-lg shadow-xl border-4 border-white p-8 max-w-md w-full relative ring-4 ring-blue-200">
        {/* Bells Holly */}
        <Image
          src="/bells-holly.png"
          alt="Bells Holly"
          width={128}
          height={128}
          className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-24 animate-bounce"
        />

        {/* Title */}
        <h1 className="text-3xl font-bold text-center mb-2 text-blue-900 drop-shadow-lg">
          GiftDraw
        </h1>
        <p className="text-center text-gray-700 mb-6">Welcome to Secret Santa!</p>

        {/* Username or Email input */}
        <input
          type="text"
          placeholder="Enter your username or email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border-2 border-blue-600 rounded-md p-3 mb-4 
                     focus:ring-2 focus:ring-blue-400 
                     bg-white text-black placeholder-gray-600 shadow-sm"
        />

        {/* Password input */}
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border-2 border-blue-600 rounded-md p-3 mb-6 
                     focus:ring-2 focus:ring-blue-400 
                     bg-white text-black placeholder-gray-600 shadow-sm"
        />

        {/* Login button */}
        <button
          onClick={handleEmailLogin}
          disabled={loading || redirecting}
          className={`w-full font-semibold py-3 rounded-md transition 
            ${loading || redirecting ? "bg-gray-400 cursor-not-allowed text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* Error message */}
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        {/* Divider */}
        <div className="text-center text-gray-700 my-4">or</div>

        {/* Google login button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading || redirecting}
          className={`w-full flex items-center justify-center border border-gray-300 py-3 rounded-md transition shadow-sm 
            ${loading || redirecting ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          <Image
            src="/google-logo.png"
            alt="Google"
            width={24}
            height={24}
            className="mr-3"
          />
          <span className="text-base font-medium">
            {redirecting ? "Redirecting…" : "Continue with Google"}
          </span>
        </button>

        {/* Action links */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => router.push("/create-account")}
            className="w-[48%] text-center bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition font-medium shadow"
          >
            Create Account
          </button>
          <button
            onClick={() => router.push("/forgot-password")}
            className="w-[48%] text-center bg-red-500 text-white py-2 rounded-md hover:bg-red-600 transition font-medium shadow"
          >
            Forgot Password?
          </button>
        </div>

        {/* Footer decorations */}
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