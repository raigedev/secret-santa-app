"use client";

import { useRouter } from "next/navigation";

type Props = {
  recipientNames: string[];
};

export default function SecretSantaCard({ recipientNames }: Props) {
  const router = useRouter();
  const hasAssignments = recipientNames.length > 0;

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-sky-200/70 bg-[linear-gradient(145deg,#65a8ff_0%,#4d8ff8_45%,#7db8ff_100%)] p-5 text-white shadow-[0_28px_80px_rgba(59,130,246,0.22)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.35),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.16),transparent_30%)]" />
      <div className="absolute right-5 top-5 h-16 w-16 rounded-full border border-white/30 bg-white/12 blur-[1px]" />
      <div className="absolute bottom-6 right-10 h-3 w-3 rounded-full bg-white/60" />
      <div className="absolute left-8 top-20 h-2 w-2 rounded-full bg-white/70" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-sky-700">
            <span aria-hidden="true">Santa</span>
            <span>Your Secret Santa</span>
          </div>
          <h2 className="text-[1.55rem] font-bold leading-tight text-white">
            {hasAssignments ? "Your draw is ready" : "Waiting for the draw"}
          </h2>
          <p className="mt-1 text-sm text-sky-100/95">
            {hasAssignments
              ? "Open your assignments and start planning the surprise."
              : "Once your group finishes the draw, your recipient will appear here."}
          </p>
        </div>
        <span className="inline-flex rounded-full bg-white/18 px-3 py-1 text-xs font-semibold tracking-wide text-white/90">
          {hasAssignments ? "Draw completed" : "Pending draw"}
        </span>
      </div>

      <div className="relative z-10 mt-5 rounded-[26px] border border-white/55 bg-white/92 p-4 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(145deg,#eff6ff,#dbeafe)] px-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 shadow-[0_16px_40px_rgba(148,163,184,0.18)]">
            {hasAssignments ? "Ready" : "Waiting"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">
              {hasAssignments ? "Assigned recipients" : "Status"}
            </p>
            {hasAssignments ? (
              <ul className="mt-3 space-y-2">
                {recipientNames.slice(0, 3).map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
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
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5"
          >
            <span>{hasAssignments ? "Open assignments" : "Open Secret Santa"}</span>
            <span aria-hidden="true">{"->"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
