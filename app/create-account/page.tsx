"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CreateAccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(false);

  const nextPath = (() => {
    const candidate = searchParams.get("next") || "/dashboard";
    return candidate.startsWith("/") ? candidate : "/dashboard";
  })();

  const rememberNextPath = () => {
    document.cookie = `post_login_next=${encodeURIComponent(nextPath)}; Path=/; Max-Age=86400; SameSite=Lax`;
  };

  const handleSignup = async () => {
    setError("");
    rememberNextPath();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setConfirmation(true);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0" />

      <div className="relative z-10 max-w-md w-full p-8 rounded-xl shadow-xl bg-white/70 backdrop-blur-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-yellow-700">
          🎄 Create Your Account 🎁
        </h1>

        {!confirmation ? (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-600 text-gray-900"
            />

            <input
              type="email"
              placeholder="Your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-600 text-gray-900"
            />

            <input
              type="password"
              placeholder="Your Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-600 text-gray-900"
            />

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleSignup}
              className="w-full py-3 rounded-lg text-white font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-lg hover:scale-105 transition"
            >
              🎉 Sign Up
            </button>

            <p className="text-sm text-center mt-4">
              Already have an account?{" "}
              <button
                onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
                className="text-blue-600 hover:underline"
              >
                Sign in instead
              </button>
            </p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-green-700 font-semibold">✅ Account created successfully!</p>
            <p className="text-gray-700">
              Please check your email inbox for a confirmation link to activate your account.
            </p>
            <button
              onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
              className="mt-4 px-6 py-2 rounded-lg text-white font-bold bg-gradient-to-r from-green-400 to-green-600 shadow-lg hover:scale-105 transition"
            >
              🎁 Go to Login
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function CreateAccountFallback() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0" />
      <div className="relative z-10 max-w-md w-full p-8 rounded-xl shadow-xl bg-white/70 backdrop-blur-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-yellow-700">
          🎄 Create Your Account 🎁
        </h1>
        <p className="text-center text-gray-700">Loading sign up...</p>
      </div>
    </main>
  );
}

export default function CreateAccountPage() {
  return (
    <Suspense fallback={<CreateAccountFallback />}>
      <CreateAccountPageInner />
    </Suspense>
  );
}
