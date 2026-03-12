"use client"; // allows React hooks in Next.js App Router

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Login with Supabase
  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      alert(error.message);
    } else {
      alert("Logged in successfully!");
    }
  }

  // Signup with Supabase
  async function handleSignup() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      alert(error.message);
    } else {
      alert("Signup successful! Check your email for confirmation.");
    }
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Login / Signup</h1>
      <input
        className="border p-2 w-full mb-2"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-2"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          className="bg-blue-500 text-white px-4 py-2"
          onClick={handleLogin}
        >
          Login
        </button>
        <button
          className="bg-green-500 text-white px-4 py-2"
          onClick={handleSignup}
        >
          Signup
        </button>
      </div>
    </main>
  );
}