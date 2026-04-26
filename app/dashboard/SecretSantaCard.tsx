"use client";

import { useRouter } from "next/navigation";

import { ArrowRightIcon, GiftIcon } from "./dashboard-icons";

type Props = {
  recipientNames: string[];
};

function SantaHatIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 16.5c0-4.7 2.8-8.2 7.2-10.9.8-.5 1.8.2 1.6 1.2l-.6 3.1 2.7.7c1.4.4 2.1 2 1.3 3.3l-1.3 2.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 16.5h15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="18.4" cy="16.6" r="1.7" fill="currentColor" />
    </svg>
  );
}

function SnowflakeIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 3v18M4.5 7.5l15 9M4.5 16.5l15-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M6.5 9 4.5 7.5l.9-3M17.5 15 19.5 16.5l-.9 3M6.5 15 4.5 16.5l.9 3M17.5 9 19.5 7.5l-.9-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DecorativeGiftBox({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <ellipse cx="60" cy="102" rx="32" ry="8" fill="rgba(15,23,42,0.18)" />
      <rect x="27" y="56" width="66" height="42" rx="9" fill="#A95AA8" />
      <rect x="27" y="56" width="66" height="9" rx="4.5" fill="#8C3E8A" />
      <rect x="23" y="46" width="74" height="16" rx="6" fill="#B96AB8" />
      <rect x="55" y="46" width="10" height="52" fill="#F6C343" />
      <rect x="23" y="53" width="74" height="8" fill="#F6C343" />
      <path d="M60 30c-6 0-12 3-12 9 0 4 4 7 9 7h3V30Z" fill="#FFD76A" />
      <path d="M60 30c6 0 12 3 12 9 0 4-4 7-9 7h-3V30Z" fill="#FFC94D" />
      <circle cx="60" cy="45" r="5" fill="#F6C343" />
      <circle cx="26" cy="36" r="2.8" fill="#FFD76A" />
      <circle cx="92" cy="32" r="2.5" fill="#F8A7C8" />
      <circle cx="96" cy="43" r="1.9" fill="#7DD3FC" />
      <circle cx="20" cy="48" r="2" fill="#A7F3D0" />
    </svg>
  );
}

export default function SecretSantaCard({ recipientNames }: Props) {
  const router = useRouter();
  const hasAssignments = recipientNames.length > 0;

  return (
    <div className="group rounded-[34px] p-[2.5px] transition duration-300 hover:-translate-y-0.5 bg-[linear-gradient(135deg,#fecdd3,#f43f5e,#9f1239,#fda4af,#881337)] shadow-[0_32px_80px_rgba(127,29,29,0.38)]">
      <section className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,#d44949_0%,#b8324e_38%,#8c2f7d_100%)] p-5 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.3),transparent_33%),radial-gradient(circle_at_bottom_right,rgba(255,225,170,0.24),transparent_36%)]" />
        {/* Wrapping paper cross-hatch texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,1) 0, rgba(255,255,255,1) 1px, transparent 1px, transparent 14px), repeating-linear-gradient(-45deg, rgba(255,255,255,1) 0, rgba(255,255,255,1) 1px, transparent 1px, transparent 14px)"}}
        />
        {/* Foil shimmer streak */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(108deg,transparent_10%,rgba(255,255,255,0.07)_22%,rgba(255,255,255,0.17)_32%,rgba(255,255,255,0.05)_40%,transparent_50%)]" />
        {/* Ribbon cross — horizontal */}
        <div className="pointer-events-none absolute left-0 right-0 top-[38%] h-[3px] bg-white/18" />
        {/* Ribbon cross — vertical (top zone only) */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[38%] w-[3px] -translate-x-1/2 bg-white/18" />
        {/* Wrapping paper fold — top-right corner */}
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-10 w-10 overflow-hidden">
          <div className="absolute -right-5 -top-5 h-10 w-10 rotate-45 bg-rose-100/25 shadow-[inset_-1px_1px_3px_rgba(255,255,255,0.2)]" />
        </div>
        {/* Ribbon/bow — bottom-left */}
        <div className="pointer-events-none absolute bottom-0 left-10 h-20 w-2 rounded-t-full bg-white/14" />
        <div className="pointer-events-none absolute bottom-14 left-0 h-2 w-24 bg-white/12" />
        <div className="pointer-events-none absolute bottom-11 left-7 z-0 flex h-6 w-6 items-center justify-center rounded-full border border-white/35 bg-white/18 shadow-[0_6px_16px_rgba(15,23,42,0.12)]">
          <span className="absolute -left-2.5 h-3.5 w-3.5 rotate-12 rounded-full border border-white/35 bg-white/16" />
          <span className="absolute -right-2.5 h-3.5 w-3.5 -rotate-12 rounded-full border border-white/35 bg-white/16" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-100/95" />
        </div>
        {/* Gift box illustration — top right */}
        <div className="pointer-events-none absolute right-2 top-11 opacity-85">
          <DecorativeGiftBox className="h-[64px] w-[64px]" />
        </div>
        {/* Sparkles */}
        <span className="pointer-events-none absolute left-5 top-4 select-none text-base leading-none text-white/22">✦</span>
        <span className="pointer-events-none absolute bottom-[28%] right-5 select-none text-sm leading-none text-white/18">✦</span>
        <span className="pointer-events-none absolute left-[40%] top-[12%] select-none text-xs leading-none text-white/15">✦</span>
        <span className="pointer-events-none absolute right-[28%] bottom-[12%] select-none text-[10px] leading-none text-white/12">✦</span>

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1 text-sm font-semibold text-rose-700 shadow-[0_8px_20px_rgba(15,23,42,0.1)]">
            <SantaHatIcon />
            <span>Your Secret Santa</span>
          </div>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-white">
            {hasAssignments ? "Your recipient is ready" : "Waiting for names to be drawn"}
          </h2>
          <p className="mt-1.5 text-sm text-rose-50/95">
            {hasAssignments
              ? "Open your recipient details and start planning the gift."
              : "When the organizer draws names, your recipient will appear here."}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
            hasAssignments
              ? "bg-emerald-100/95 text-emerald-700"
              : "bg-white/22 text-white/95"
          }`}
        >
          {hasAssignments ? "Names drawn" : "Names not drawn yet"}
        </span>
      </div>

      <div className="relative z-10 mt-5 overflow-hidden rounded-[26px] border border-white/60 bg-white/94 p-4 text-slate-800 shadow-[0_4px_18px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.9)]">
        {/* Left accent bar */}
        <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-[26px] bg-rose-500" />
        {/* Soft paper texture inside panel */}
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.18)_1px,transparent_0)] [background-size:16px_16px]" />
        <div className="pl-3">
        <div className="relative z-10 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
            Surprise details
          </p>
          <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700">
            Gift ready
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-xs font-semibold text-rose-700">
            Anonymous draw
          </div>
          <div className="rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-xs font-semibold text-rose-700">
            Private reveal
          </div>
        </div>
        <div className="mt-3 flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(145deg,#fff7ed,#fee2e2)] text-rose-700 shadow-[0_18px_42px_rgba(148,163,184,0.2)]">
            {hasAssignments ? <GiftIcon className="h-8 w-8" /> : <SnowflakeIcon />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-500">
              {hasAssignments ? "Assigned recipients" : "Status"}
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              {hasAssignments
                ? `${recipientNames.length} recipient${recipientNames.length === 1 ? "" : "s"}`
                : "Waiting for organizer"}
            </div>
            {hasAssignments ? (
              <ul className="mt-3 space-y-2">
                {recipientNames.slice(0, 3).map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{name}</span>
                  </li>
                ))}
                {recipientNames.length > 3 && (
                  <li className="text-xs font-semibold text-slate-500">
                    +{recipientNames.length - 3} more recipients
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
                Your group is still getting ready. Your recipient will appear here after names are drawn.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => router.push("/secret-santa")}
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#d94633,#b91c1c)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(127,29,29,0.28)] transition hover:-translate-y-0.5 group-hover:shadow-[0_18px_42px_rgba(127,29,29,0.34)]"
          >
            <span>{hasAssignments ? "View recipient" : "Open Secret Santa"}</span>
            <ArrowRightIcon />
          </button>
        </div>
        </div>
      </div>
      </section>
    </div>
  );
}
