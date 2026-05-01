import {
  buildExchangeLifecycleSummary,
  type ExchangeLifecycleStep,
  type ExchangeLifecycleStatus,
} from "@/lib/exchange-lifecycle";
import type { GiftProgressSummary, Group } from "./dashboard-types";
import { ArrowRightIcon, GiftIcon } from "./dashboard-icons";

type DashboardMissionBoardProps = {
  countdownNow: number;
  giftProgressSummary: GiftProgressSummary | null;
  groups: Group[];
  isDarkTheme: boolean;
  pendingInviteCount: number;
  recipientCount: number;
  wishlistItemCount: number;
  onNavigate: (path: string) => void;
};

function getGroupEventTime(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getFocusGroup(groups: Group[]): Group | null {
  return (
    [...groups].sort(
      (left, right) => getGroupEventTime(left.event_date) - getGroupEventTime(right.event_date)
    )[0] || null
  );
}

function getStatusClasses(status: ExchangeLifecycleStatus, isDarkTheme: boolean): string {
  switch (status) {
    case "done":
      return isDarkTheme
        ? "border-emerald-400/24 bg-emerald-400/12 text-emerald-100"
        : "border-[#48664e]/18 bg-[#d7fadb]/52 text-[#48664e]";
    case "attention":
      return isDarkTheme
        ? "border-rose-300/24 bg-rose-400/12 text-rose-100"
        : "border-[#a43c3f]/20 bg-[#ffdad8]/58 text-[#812227]";
    case "current":
      return isDarkTheme
        ? "border-amber-300/24 bg-amber-300/12 text-amber-100"
        : "border-[#fcce72]/34 bg-[#fff7df] text-[#7b5902]";
    case "locked":
    default:
      return isDarkTheme
        ? "border-slate-700 bg-slate-800/62 text-slate-400"
        : "border-slate-200 bg-white/72 text-slate-500";
  }
}

function MissionStep({
  isDarkTheme,
  step,
}: {
  isDarkTheme: boolean;
  step: ExchangeLifecycleStep;
}) {
  return (
    <li className={`rounded-[18px] border px-3 py-3 ${getStatusClasses(step.status, isDarkTheme)}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-black">{step.label}</span>
        <span className="h-2 w-2 rounded-full bg-current opacity-75" aria-hidden="true" />
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 opacity-80">
        {step.helper}
      </p>
    </li>
  );
}

export function DashboardMissionBoard({
  countdownNow,
  giftProgressSummary,
  groups,
  isDarkTheme,
  pendingInviteCount,
  recipientCount,
  wishlistItemCount,
  onNavigate,
}: DashboardMissionBoardProps) {
  const focusGroup = getFocusGroup(groups);
  const readyGiftCount = giftProgressSummary?.readyToGiveCount || 0;
  const giftProgressTotal = giftProgressSummary?.totalAssignments || recipientCount;
  const lifecycle = buildExchangeLifecycleSummary(
    {
      acceptedCount: focusGroup?.members.length || 0,
      eventDate: focusGroup?.event_date || null,
      giftProgressTotal,
      hasDrawn: Boolean(focusGroup?.hasDrawn || recipientCount > 0),
      isOwner: Boolean(focusGroup?.isOwner),
      memberCount: focusGroup?.members.length || 0,
      pendingInviteCount,
      readyGiftCount,
      recipientCount,
      wishlistItemCount,
    },
    countdownNow
  );
  const panelClass = isDarkTheme
    ? "border border-slate-700/70 bg-slate-900/86 text-slate-100"
    : "border border-[rgba(72,102,78,.12)] bg-white/92 text-slate-950";
  const mutedTextClass = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const quietTextClass = isDarkTheme ? "text-slate-500" : "text-slate-400";
  const actionClass =
    lifecycle.nextAction.tone === "red"
      ? "bg-[#a43c3f] text-white shadow-[0_16px_30px_rgba(164,60,63,.2)]"
      : lifecycle.nextAction.tone === "neutral"
        ? isDarkTheme
          ? "bg-slate-800 text-slate-100"
          : "bg-slate-100 text-slate-700"
        : "bg-[#48664e] text-white shadow-[0_16px_30px_rgba(72,102,78,.18)]";
  const daysText =
    lifecycle.daysUntilEvent === null
      ? "No date set"
      : lifecycle.daysUntilEvent < 0
        ? "Gift day passed"
        : lifecycle.daysUntilEvent === 0
          ? "Gift day today"
          : `${lifecycle.daysUntilEvent} day${lifecycle.daysUntilEvent === 1 ? "" : "s"} left`;

  return (
    <section data-fade className={`mb-8 overflow-hidden rounded-[30px] p-5 shadow-[0_14px_32px_rgba(45,51,55,0.05)] sm:p-6 ${panelClass}`}>
      {lifecycle.isPanicWindow && (
        <div
          className="mb-5 rounded-[22px] border px-4 py-3"
          style={{
            background: "linear-gradient(135deg,rgba(164,60,63,.14),rgba(252,206,114,.16))",
            borderColor: "rgba(164,60,63,.2)",
          }}
        >
          <p className="text-[12px] font-black uppercase tracking-[0.14em] text-[#812227]">
            Gift day is close
          </p>
          <p className={`mt-1 text-sm font-bold leading-6 ${isDarkTheme ? "text-rose-50" : "text-[#3f2d2f]"}`}>
            Review your gift ideas and progress before the exchange starts.
          </p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${quietTextClass}`}>
                Exchange mission
              </p>
              <h2 className="mt-2 text-[1.9rem] font-black leading-tight tracking-tight">
                {focusGroup ? focusGroup.name : "Start your first exchange"}
              </h2>
              <p className={`mt-2 max-w-2xl text-[15px] font-semibold leading-7 ${mutedTextClass}`}>
                {focusGroup
                  ? "One clear path from setup to shopping, gift day, and history."
                  : "Create a group, set the gift day and budget, then invite members."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate(lifecycle.nextAction.href)}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-extrabold transition hover:-translate-y-0.5 ${actionClass}`}
            >
              {lifecycle.nextAction.label}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>

          <ol className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
            {lifecycle.steps.map((step) => (
              <MissionStep key={step.id} isDarkTheme={isDarkTheme} step={step} />
            ))}
          </ol>
        </div>

        <aside className={`rounded-[26px] p-4 ${isDarkTheme ? "bg-slate-950/42" : "bg-[#f8fbff]"}`}>
          <div className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-[18px] ${
                isDarkTheme ? "bg-emerald-400/12 text-emerald-100" : "bg-[#48664e]/10 text-[#48664e]"
              }`}
            >
              <GiftIcon className="h-5 w-5" />
            </span>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${quietTextClass}`}>
                Readiness
              </p>
              <p className="text-[24px] font-black leading-none">{lifecycle.readinessPercent}%</p>
            </div>
          </div>

          <div className={`mt-4 h-2.5 overflow-hidden rounded-full ${isDarkTheme ? "bg-slate-800" : "bg-white"}`}>
            <div
              className="h-full rounded-full bg-[#48664e]"
              style={{ width: `${lifecycle.readinessPercent}%` }}
            />
          </div>

          <div className={`mt-4 space-y-2 text-[12px] font-bold ${mutedTextClass}`}>
            <p>{daysText}</p>
            <p>
              {wishlistItemCount} wishlist idea{wishlistItemCount === 1 ? "" : "s"} in active exchanges.
            </p>
            <p>
              {readyGiftCount}/{Math.max(giftProgressTotal, 0)} gift progress item
              {giftProgressTotal === 1 ? "" : "s"} ready.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
