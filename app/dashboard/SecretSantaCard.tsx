"use client";

import { useRouter } from "next/navigation";

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

function GiftIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 10v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M9.2 10c-1.6 0-2.7-1-2.7-2.3 0-1.1.8-2 1.9-2 1.7 0 2.9 2.1 3.6 4.3H9.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14.8 10c1.6 0 2.7-1 2.7-2.3 0-1.1-.8-2-1.9-2-1.7 0-2.9 2.1-3.6 4.3h2.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
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

function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 10h12M11.5 5.5 16 10l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SecretSantaCard({ recipientNames }: Props) {
  const router = useRouter();
  const hasAssignments = recipientNames.length > 0;

  return (
    <section className="group relative overflow-hidden rounded-[32px] border border-rose-200/70 bg-[linear-gradient(145deg,#d44949_0%,#b8324e_38%,#8c2f7d_100%)] p-5 text-white shadow-[0_30px_90px_rgba(127,29,29,0.28)] transition duration-300 hover:-translate-y-0.5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.3),transparent_33%),radial-gradient(circle_at_bottom_right,rgba(255,225,170,0.24),transparent_36%)]" />
      <div className="pointer-events-none absolute bottom-0 left-10 h-20 w-2 rounded-t-full bg-white/14" />
      <div className="pointer-events-none absolute bottom-14 left-0 h-2 w-24 bg-white/12" />
      <div className="pointer-events-none absolute bottom-11 left-7 z-0 flex h-6 w-6 items-center justify-center rounded-full border border-white/35 bg-white/18 shadow-[0_6px_16px_rgba(15,23,42,0.12)]">
        <span className="absolute -left-2.5 h-3.5 w-3.5 rotate-12 rounded-full border border-white/35 bg-white/16" />
        <span className="absolute -right-2.5 h-3.5 w-3.5 -rotate-12 rounded-full border border-white/35 bg-white/16" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-100/95" />
      </div>
      {/* Gift box watermark — top right */}
      <div className="pointer-events-none absolute right-4 top-3 opacity-[0.22]">
        <div className="relative w-14">
          <div className="absolute -top-2.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5">
            <div className="h-3.5 w-4 -rotate-12 rounded-full border border-white bg-white/45" />
            <div className="h-2 w-2 rounded-full bg-white" />
            <div className="h-3.5 w-4 rotate-12 rounded-full border border-white bg-white/45" />
          </div>
          <div className="h-3 w-14 rounded-t-[4px] border border-white bg-white/30" />
          <div className="relative mt-px h-11 w-14 rounded-b-[4px] border border-white bg-white/30">
            <div className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 bg-white/90" />
          </div>
        </div>
      </div>
      {/* Sparkle stars */}
      <span className="pointer-events-none absolute left-4 top-3 select-none text-sm leading-none text-white/20">✦</span>
      <span className="pointer-events-none absolute bottom-[32%] right-4 select-none text-base leading-none text-white/18">✦</span>
      <span className="pointer-events-none absolute left-[42%] top-[15%] select-none text-xs leading-none text-white/16">✦</span>

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1 text-sm font-semibold text-rose-700 shadow-[0_8px_20px_rgba(15,23,42,0.1)]">
            <SantaHatIcon />
            <span>Your Secret Santa</span>
          </div>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-white">
            {hasAssignments ? "Your draw is ready" : "Waiting for the draw"}
          </h2>
          <p className="mt-1.5 text-sm text-rose-50/95">
            {hasAssignments
              ? "Open your assignments and start planning the surprise."
              : "Once your group finishes the draw, your recipient will appear here."}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
            hasAssignments
              ? "bg-emerald-100/95 text-emerald-700"
              : "bg-white/22 text-white/95"
          }`}
        >
          {hasAssignments ? "Draw completed" : "Pending draw"}
        </span>
      </div>

      <div className="relative z-10 mt-5 rounded-[26px] border border-white/60 bg-white/94 p-4 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(145deg,#fff7ed,#fee2e2)] text-rose-700 shadow-[0_18px_42px_rgba(148,163,184,0.2)]">
            {hasAssignments ? <GiftIcon /> : <SnowflakeIcon />}
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
                    +{recipientNames.length - 3} more assignments
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
                Your group is still getting ready. We will surface your recipient here as soon as the draw is done.
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
            <span>{hasAssignments ? "Open assignments" : "Open Secret Santa"}</span>
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
