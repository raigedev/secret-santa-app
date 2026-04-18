"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFriendlySignupError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("error sending confirmation email") ||
    normalized.includes("smtp") ||
    normalized.includes("rate limit")
  ) {
    return "We couldn't send the confirmation email right now. Please try again later. If this keeps happening, the app owner needs to configure Supabase Custom SMTP.";
  }

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "This email already has an account. Please sign in instead.";
  }

  return message || "Signup failed. Please try again.";
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

  const nextPath = (() => {
    const candidate = searchParams.get("next") || "/dashboard";
    return candidate.startsWith("/") ? candidate : "/dashboard";
  })();

  const rememberNextPath = () => {
    document.cookie = `post_login_next=${encodeURIComponent(nextPath)}; Path=/; Max-Age=86400; SameSite=Lax`;
  };

  const handleSignup = async () => {
    if (isSubmitting) {
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

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
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
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 px-4 py-12 sm:px-6">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0" />

      <div className="relative z-10 w-full max-w-md rounded-xl bg-white/70 p-5 shadow-xl backdrop-blur-md sm:p-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-yellow-700 sm:text-3xl">
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

            <p className="text-xs text-gray-500">
              Use at least {MIN_PASSWORD_LENGTH} characters.
            </p>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleSignup}
              disabled={isSubmitting}
              className={`w-full rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-600 py-3 font-bold text-white shadow-lg transition ${
                isSubmitting ? "cursor-not-allowed opacity-70" : "hover:scale-105"
              }`}
            >
              {isSubmitting ? "Sending confirmation..." : "🎉 Sign Up"}
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
          <div className="space-y-4 text-center">
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
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 px-4 py-12 sm:px-6">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0" />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white/70 p-6 shadow-xl backdrop-blur-md sm:p-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-yellow-700 sm:text-3xl">
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
