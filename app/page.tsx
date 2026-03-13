"use client";
import { useRouter } from "next/navigation";

export default function Landing() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-400 to-red-300 text-white relative">
      {/* Festive background decorations */}
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20"></div>

      {/* Header */}
      <h1 className="text-5xl font-bold mb-4">🎁 GiftDraw</h1>
      <p className="text-lg mb-8">Welcome to Secret Santa!</p>

      {/* Redirect button */}
      <button
        onClick={() => router.push("/login")}
        className="bg-white text-red-600 font-bold px-6 py-3 rounded-lg shadow-lg hover:bg-red-100 transition"
      >
        Enter the Secret Santa Login
      </button>

      {/* Footer decorations */}
      <div className="mt-12 flex gap-4">
        <img src="/gifts.png" alt="Christmas gifts" className="h-20" />
        <img src="/santa-hat.png" alt="Santa hat" className="h-20" />
      </div>
    </main>
  );
}