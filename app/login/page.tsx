"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  const handleEmailLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('/snowflakes.png')] bg-cover bg-center">
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
          className="w-full border border-gray-300 rounded-md p-3 mb-4 focus:ring-2 focus:ring-blue-300"
        />

        {/* Password input */}
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-3 mb-6 focus:ring-2 focus:ring-blue-300"
        />

        {/* Login button */}
        <button
          onClick={handleEmailLogin}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-md hover:bg-blue-700 transition"
        >
          Login
        </button>

        {/* Error message */}
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        {/* Divider */}
        <div className="text-center text-gray-700 my-4">or</div>

        {/* Google login button */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center border border-gray-300 bg-white text-gray-700 py-3 rounded-md hover:bg-gray-50 transition shadow-sm"
        >
          <Image
            src="/google-logo.png"
            alt="Google"
            width={24}
            height={24}
            className="mr-3"
          />
          <span className="text-base font-medium">Continue with Google</span>
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
            className="w-[48%] text-center bg-gray-500 text-white py-2 rounded-md hover:bg-gray-600 transition font-medium shadow"
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