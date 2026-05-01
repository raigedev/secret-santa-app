import { NotificationEnvelopeMark } from "@/app/notifications/NotificationEnvelopeMark";
import type { ExchangeLifecycleStatus, ExchangeLifecycleStep } from "@/lib/exchange-lifecycle";
import { formatRelativeTime } from "./dashboard-formatters";
import { GiftIcon } from "./dashboard-icons";
import type { DashboardNotificationPreviewItem } from "./dashboard-types";

export type QuickStartItem = {
  done: boolean;
  helper: string;
  label: string;
};

type HealthRow = {
  label: string;
  percent: number;
  value: string;
};

export function getPanelClass(isDarkTheme: boolean): string {
  return isDarkTheme
    ? "border border-slate-700/60 bg-slate-900/84 text-slate-100"
    : "border border-[rgba(174,179,177,.22)] bg-[#f9faf8]/78 text-[#2e3432] backdrop-blur-2xl";
}

function getStepShellClass(status: ExchangeLifecycleStatus, isDarkTheme: boolean): string {
  if (status === "done") {
    return isDarkTheme ? "bg-emerald-300 text-slate-950" : "bg-[#48664e] text-white";
  }

  if (status === "attention") {
    return isDarkTheme
      ? "border-4 border-rose-300 bg-slate-950 text-rose-100"
      : "border-4 border-[#a43c3f] bg-white text-[#a43c3f]";
  }

  if (status === "current") {
    return isDarkTheme
      ? "border-4 border-emerald-300 bg-slate-950 text-emerald-100"
      : "border-4 border-[#48664e] bg-white text-[#48664e]";
  }

  return isDarkTheme ? "bg-slate-800 text-slate-500" : "bg-[#dfe4e1] text-slate-400";
}

export function MissionStepNode({
  index,
  isDarkTheme,
  step,
}: {
  index: number;
  isDarkTheme: boolean;
  step: ExchangeLifecycleStep;
}) {
  return (
    <li className="relative z-10 flex flex-1 flex-col items-center gap-3 text-center">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-black shadow-[0_14px_28px_rgba(46,52,50,.08)] ${getStepShellClass(
          step.status,
          isDarkTheme
        )}`}
      >
        {step.status === "done" ? "OK" : index + 1}
      </span>
      <span
        className={`text-[12px] font-black ${
          step.status === "locked"
            ? isDarkTheme
              ? "text-slate-500"
              : "text-slate-400"
            : isDarkTheme
              ? "text-emerald-100"
              : "text-[#48664e]"
        }`}
      >
        {step.label}
      </span>
      <span
        className={`hidden max-w-36 text-[11px] font-semibold leading-5 md:block ${
          isDarkTheme ? "text-slate-400" : "text-slate-500"
        }`}
      >
        {step.helper}
      </span>
    </li>
  );
}

export function GiftPanicBanner({
  pendingGiftCount,
  onNavigate,
}: {
  pendingGiftCount: number;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-[#a43c3f] px-5 py-3 text-white shadow-[0_18px_40px_rgba(164,60,63,.18)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/18 text-[17px] font-black">
          !
        </span>
        <p className="text-[14px] font-black">
          Gift day is close. {pendingGiftCount} gift progress update
          {pendingGiftCount === 1 ? "" : "s"} still need attention.
        </p>
      </div>
      <button
        type="button"
        onClick={() => onNavigate("/gift-tracking")}
        className="rounded-full bg-white/18 px-4 py-2 text-[12px] font-black transition hover:bg-white/28"
      >
        Review progress
      </button>
    </div>
  );
}

export function QuickStartChecklist({
  items,
  isDarkTheme,
}: {
  items: QuickStartItem[];
  isDarkTheme: boolean;
}) {
  return (
    <section className={`rounded-3xl p-5 shadow-[0_16px_40px_rgba(46,52,50,.05)] ${getPanelClass(isDarkTheme)}`}>
      <h3 className="text-[18px] font-black">Quick start checklist</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
              item.done
                ? isDarkTheme
                  ? "bg-emerald-300/12 text-emerald-100"
                  : "bg-[#d7fadb]/74 text-[#48664e]"
                : isDarkTheme
                  ? "border border-dashed border-slate-700 text-slate-400"
                  : "border border-dashed border-slate-300 text-slate-500"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                item.done ? "bg-[#48664e] text-white" : "bg-white text-slate-300"
              }`}
            >
              {item.done ? "OK" : ""}
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-black">{item.label}</span>
              <span className="block truncate text-[11px] font-semibold opacity-72">
                {item.helper}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MysteryEnvelopes({
  isDarkTheme,
  items,
  onNavigate,
}: {
  isDarkTheme: boolean;
  items: DashboardNotificationPreviewItem[];
  onNavigate: (path: string) => void;
}) {
  const mutedClass = isDarkTheme ? "text-slate-400" : "text-slate-500";

  return (
    <section className={`rounded-3xl p-5 shadow-[0_16px_40px_rgba(46,52,50,.05)] ${getPanelClass(isDarkTheme)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[18px] font-black">
          <NotificationEnvelopeMark className="h-7 w-7" type="invite" />
          Mystery envelopes
        </h3>
        <button
          type="button"
          aria-label="Open mystery envelopes"
          onClick={() => onNavigate("/notifications")}
          className="rounded-full px-3 py-1.5 text-[12px] font-black text-[#a43c3f] transition hover:bg-[#a43c3f]/10"
        >
          View all notifications
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div
            className={`rounded-3xl px-4 py-6 text-[13px] font-semibold ${
              isDarkTheme ? "bg-slate-950/36 text-slate-400" : "bg-[#f2f4f2] text-slate-500"
            }`}
          >
            Invites, wishlist updates, and private messages will appear here as sealed notes.
          </div>
        ) : (
          items.slice(0, 3).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.href || "/notifications")}
              className={`flex w-full items-center justify-between gap-4 rounded-3xl p-4 text-left transition hover:-translate-y-0.5 ${
                isDarkTheme ? "bg-slate-950/42 hover:bg-slate-800/70" : "bg-[#f2f4f2] hover:bg-[#e7e8e6]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
                  <NotificationEnvelopeMark className="h-7 w-7" type="chat" />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-1 text-[14px] font-black">{item.title}</span>
                  <span className={`mt-0.5 block text-[12px] font-semibold ${mutedClass}`}>
                    Open the sealed update
                  </span>
                </span>
              </span>
              <span className={`shrink-0 text-[10px] font-bold ${mutedClass}`}>
                {formatRelativeTime(item.createdAt)}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

export function OwnerExchangeHealth({
  drawDone,
  healthRows,
  isDarkTheme,
}: {
  drawDone: boolean;
  healthRows: HealthRow[];
  isDarkTheme: boolean;
}) {
  return (
    <section className={`rounded-3xl p-5 shadow-[0_16px_40px_rgba(46,52,50,.05)] ${getPanelClass(isDarkTheme)}`}>
      <h3 className="flex items-center gap-2 text-[18px] font-black">
        <GiftIcon className="h-5 w-5 text-[#48664e]" />
        Owner exchange health
      </h3>
      <div className="mt-5 space-y-5">
        {healthRows.map((row) => (
          <div key={row.label} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-[12px] font-black">
              <span>{row.label}</span>
              <span className="text-[#48664e]">{row.value}</span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full ${isDarkTheme ? "bg-slate-800" : "bg-white"}`}>
              <div className="h-full rounded-full bg-[#48664e]" style={{ width: `${row.percent}%` }} />
            </div>
          </div>
        ))}
        <div
          className={`rounded-3xl px-4 py-3 text-[12px] font-bold ${
            isDarkTheme ? "bg-slate-950/42 text-slate-300" : "bg-white/56 text-slate-600"
          }`}
        >
          {drawDone ? "Names drawn" : "Names draw when members are ready"}
        </div>
      </div>
    </section>
  );
}
