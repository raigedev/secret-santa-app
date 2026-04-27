"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

const MOODS = [
  {
    id: "warm",
    label: "Warm",
    accent: "#9f383d",
    tint: "#fff2ef",
    copy: "Comfort, memory, and useful everyday rituals.",
  },
  {
    id: "clever",
    label: "Clever",
    accent: "#3f6448",
    tint: "#edf6ee",
    copy: "Smart tools, compact upgrades, and quiet delight.",
  },
  {
    id: "bright",
    label: "Bright",
    accent: "#936800",
    tint: "#fff7df",
    copy: "Color, energy, and something fun to open.",
  },
] as const;

const OCCASIONS = ["Office exchange", "Family party", "Friend group", "Last-minute save"] as const;

type MoodId = (typeof MOODS)[number]["id"];

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    currency: "PHP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function getMood(id: MoodId) {
  return MOODS.find((mood) => mood.id === id) ?? MOODS[0];
}

function buildPlan({
  budget,
  mood,
  occasion,
  recipient,
}: {
  budget: number;
  mood: MoodId;
  occasion: string;
  recipient: string;
}) {
  const name = recipient.trim() || "your recipient";
  const anchor =
    mood === "warm"
      ? "a soft daily-use upgrade"
      : mood === "clever"
        ? "a compact gadget or desk helper"
        : "a playful statement item";
  const addOn =
    budget >= 1800
      ? "add a premium finishing touch"
      : budget >= 900
        ? "add a personal side item"
        : "keep the add-on small and specific";

  return [
    {
      title: "Anchor gift",
      detail: `Find ${anchor} for ${name}.`,
      price: Math.round(budget * 0.72),
    },
    {
      title: "Personal add-on",
      detail: `${addOn} that matches the ${occasion.toLowerCase()} tone.`,
      price: Math.round(budget * 0.2),
    },
    {
      title: "Wrap plan",
      detail: "Use one note, one color cue, and one clear label.",
      price: Math.max(80, Math.round(budget * 0.08)),
    },
  ];
}

export default function CoolAppPage() {
  const [mood, setMood] = useState<MoodId>("clever");
  const [occasion, setOccasion] = useState<(typeof OCCASIONS)[number]>("Office exchange");
  const [budget, setBudget] = useState(1500);
  const [recipient, setRecipient] = useState("Kenneth");

  const selectedMood = getMood(mood);
  const plan = useMemo(
    () => buildPlan({ budget, mood, occasion, recipient }),
    [budget, mood, occasion, recipient]
  );
  const readiness = Math.min(98, Math.round(44 + budget / 45 + recipient.trim().length * 2));

  return (
    <main className="min-h-screen bg-[#f5f6ef] text-[#243229]">
      <section className="border-b border-[#d9ded3] bg-[#fbfcf7]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6b756d]">
              Gift Radar
            </p>
            <h1 className="mt-2 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.04em] text-[#243229] sm:text-5xl">
              Build a gift plan that feels intentional.
            </h1>
          </div>
          <Link
            href="/"
            className="inline-flex w-fit items-center justify-center rounded-full border border-[#aeb9ad] px-5 py-3 text-sm font-bold text-[#3f6448] transition hover:bg-[#edf6ee]"
          >
            Back to home
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden rounded-lg border border-[#d9ded3] bg-[#243229] p-5 text-[#fbfcf7] sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#fcce72]" />
          <Image
            src="/gifts.png"
            alt=""
            width={260}
            height={220}
            priority
            className="absolute right-0 top-0 hidden h-56 w-64 object-cover opacity-20 mix-blend-screen sm:block"
          />
          <div className="relative z-10 flex h-full min-h-[440px] flex-col justify-between gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#cfd8cb]">
                Live plan
              </p>
              <h2 className="mt-4 max-w-2xl font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.04em] sm:text-6xl">
                {selectedMood.label} gift route for {recipient.trim() || "someone"}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#dce4d9]">
                {selectedMood.copy} Tune the budget, occasion, and tone, then use the shortlist as
                a quick shopping brief.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {plan.map((item, index) => (
                <div key={item.title} className="rounded-lg border border-[#435543] bg-[#2e4134] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#fcce72]">
                    Step {index + 1}
                  </div>
                  <div className="mt-3 font-[Plus_Jakarta_Sans] text-lg font-black">
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#dce4d9]">{item.detail}</p>
                  <p className="mt-4 text-sm font-bold text-[#fbfcf7]">{peso(item.price)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-8 right-8 hidden w-44 gap-2 opacity-45 lg:grid">
            {Array.from({ length: 30 }).map((_, index) => (
              <span
                key={index}
                className="h-2 rounded-full bg-[#fcce72]"
                style={{ opacity: 0.2 + ((index % 5) + 1) * 0.12 }}
              />
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-[#d9ded3] bg-[#fbfcf7] p-5 shadow-[0_24px_70px_rgba(63,100,72,0.12)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6b756d]">
                Control panel
              </p>
              <h2 className="mt-2 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em]">
                Shape the vibe
              </h2>
            </div>
            <div className="rounded-full bg-[#edf6ee] px-4 py-2 text-sm font-black text-[#3f6448]">
              {readiness}% ready
            </div>
          </div>

          <label className="mt-6 block text-sm font-bold text-[#243229]" htmlFor="recipient">
            Recipient
          </label>
          <input
            id="recipient"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[#cdd6cc] bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-[#3f6448] focus:ring-4 focus:ring-[#dfece1]"
            placeholder="Name"
          />

          <div className="mt-6">
            <p className="text-sm font-bold text-[#243229]">Mood</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {MOODS.map((item) => {
                const isActive = item.id === mood;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMood(item.id)}
                    className="rounded-lg border px-4 py-3 text-sm font-black transition active:translate-y-px"
                    style={{
                      background: isActive ? item.accent : item.tint,
                      borderColor: isActive ? item.accent : "#d9ded3",
                      color: isActive ? "#fffaf3" : "#243229",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mt-6 block text-sm font-bold text-[#243229]" htmlFor="occasion">
            Occasion
          </label>
          <select
            id="occasion"
            value={occasion}
            onChange={(event) => setOccasion(event.target.value as (typeof OCCASIONS)[number])}
            className="mt-2 w-full rounded-lg border border-[#cdd6cc] bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-[#3f6448] focus:ring-4 focus:ring-[#dfece1]"
          >
            {OCCASIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <label className="mt-6 flex items-center justify-between gap-4 text-sm font-bold text-[#243229]" htmlFor="budget">
            <span>Budget target</span>
            <span>{peso(budget)}</span>
          </label>
          <input
            id="budget"
            type="range"
            min="500"
            max="3500"
            step="100"
            value={budget}
            onChange={(event) => setBudget(Number(event.target.value))}
            className="mt-3 w-full accent-[#3f6448]"
          />

          <div className="mt-6 rounded-lg border border-[#e2d8be] bg-[#fff9ea] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7a5700]">
              Shopping brief
            </p>
            <p className="mt-3 text-sm leading-7 text-[#4f564f]">
              Look for one item near {peso(plan[0].price)}, one thoughtful add-on near{" "}
              {peso(plan[1].price)}, and a wrap detail that makes it feel personal.
            </p>
          </div>
        </aside>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-10 sm:px-8 lg:grid-cols-3">
        {[
          ["Signal", `${readiness}%`, "Confidence rises as the plan gets more specific."],
          ["Sweet spot", peso(Math.round(budget * 0.72)), "Best amount for the main gift."],
          ["Tone", selectedMood.label, selectedMood.copy],
        ].map(([label, value, detail]) => (
          <article key={label} className="rounded-lg border border-[#d9ded3] bg-[#fbfcf7] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b756d]">{label}</p>
            <p className="mt-3 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.04em]">
              {value}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5b635c]">{detail}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
