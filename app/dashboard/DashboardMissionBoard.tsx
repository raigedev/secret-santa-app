import {
  buildExchangeLifecycleSummary,
  getExchangeDaysUntilEvent,
  type ExchangeLifecycleStep,
} from "@/lib/exchange-lifecycle";
import { ArrowRightIcon } from "./dashboard-icons";
import {
  GiftPanicBanner,
  getPanelClass,
  MissionStepNode,
  MysteryEnvelopes,
  OwnerExchangeHealth,
} from "./DashboardMissionBoardPanels";
import { MemoryBookPreview } from "./DashboardMissionMemoryBook";
import type {
  DashboardNotificationPreviewItem,
  GiftProgressSummary,
  Group,
} from "./dashboard-types";

type DashboardMissionBoardProps = {
  countdownNow: number;
  giftProgressSummary: GiftProgressSummary | null;
  groups: Group[];
  isDarkTheme: boolean;
  notificationPreviewItems: DashboardNotificationPreviewItem[];
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

function getProgressWidth(steps: ExchangeLifecycleStep[]): string {
  if (steps.length <= 1) {
    return "0%";
  }

  const doneIndex = steps.reduce(
    (latestDoneIndex, step, index) => (step.status === "done" ? index : latestDoneIndex),
    0
  );

  return `${Math.round((doneIndex / (steps.length - 1)) * 100)}%`;
}

function getPercent(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / total) * 100));
}

export function DashboardMissionBoard({
  countdownNow,
  giftProgressSummary,
  groups,
  isDarkTheme,
  notificationPreviewItems,
  pendingInviteCount,
  recipientCount,
  wishlistItemCount,
  onNavigate,
}: DashboardMissionBoardProps) {
  const focusGroup = getFocusGroup(groups);
  const memberCount = focusGroup?.members.length || 0;
  const readyGiftCount = giftProgressSummary?.readyToGiveCount || 0;
  const giftProgressTotal = giftProgressSummary?.totalAssignments || recipientCount;
  const lifecycle = buildExchangeLifecycleSummary(
    {
      acceptedCount: memberCount,
      eventDate: focusGroup?.event_date || null,
      giftProgressTotal,
      hasDrawn: Boolean(focusGroup?.hasDrawn || recipientCount > 0),
      isOwner: Boolean(focusGroup?.isOwner),
      memberCount,
      pendingInviteCount,
      readyGiftCount,
      recipientCount,
      wishlistItemCount,
    },
    countdownNow
  );
  const missionSteps = lifecycle.steps.filter((step) =>
    ["setup", "invites", "draw", "giftDay"].includes(step.id)
  );
  const healthRows = [
    {
      label: "Invites accepted",
      percent: getPercent(memberCount, memberCount + pendingInviteCount),
      value: `${memberCount}`,
    },
    {
      label: "Wishlists filled",
      percent: getPercent(wishlistItemCount, Math.max(memberCount, 1)),
      value: `${wishlistItemCount} ideas`,
    },
    {
      label: "Gift status",
      percent: getPercent(readyGiftCount, giftProgressTotal),
      value: `${readyGiftCount}/${Math.max(giftProgressTotal, 0)}`,
    },
  ];
  const pastPreviewGroups = groups.filter((group) => {
    const daysUntilEvent = getExchangeDaysUntilEvent(group.event_date, countdownNow);
    return typeof daysUntilEvent === "number" && daysUntilEvent < 0;
  });
  const mutedTextClass = isDarkTheme ? "text-slate-400" : "text-slate-600";
  const panelClass = getPanelClass(isDarkTheme);
  const pendingGiftCount = Math.max(giftProgressTotal - readyGiftCount, 0);

  return (
    <section data-fade className="mb-8 space-y-5">
      {lifecycle.isPanicWindow && (
        <GiftPanicBanner pendingGiftCount={pendingGiftCount} onNavigate={onNavigate} />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className={`rounded-3xl p-6 shadow-[0_16px_40px_rgba(46,52,50,.05)] ${panelClass}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7b5902]">
                  Exchange mission board
                </p>
                <h2 className="mt-2 text-[24px] font-black leading-tight">
                  {focusGroup ? focusGroup.name : "Start your first exchange"}
                </h2>
                <p className={`mt-2 max-w-2xl text-[14px] font-semibold leading-6 ${mutedTextClass}`}>
                  {focusGroup
                    ? "One clear path from setup to invites, the draw, and gift day."
                    : "Create a group, set the gift day and budget, then invite members."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(lifecycle.nextAction.href)}
                className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-black transition hover:-translate-y-0.5 ${
                  lifecycle.nextAction.tone === "red"
                    ? "bg-[#a43c3f] text-white"
                    : lifecycle.nextAction.tone === "neutral"
                      ? isDarkTheme
                        ? "bg-slate-800 text-slate-100"
                        : "bg-[#f2f4f2] text-slate-600"
                      : "bg-[#48664e] text-white"
                }`}
              >
                {lifecycle.nextAction.label}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>

            <ol className="relative mt-8 flex gap-3 overflow-x-auto px-1 pb-2">
              <span
                className={`absolute left-7 right-7 top-6 h-0.5 ${isDarkTheme ? "bg-slate-800" : "bg-[#e1e3e1]"}`}
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-[#48664e]"
                  style={{ width: getProgressWidth(missionSteps) }}
                />
              </span>
              {missionSteps.map((step, index) => (
                <MissionStepNode
                  key={step.id}
                  index={index}
                  isDarkTheme={isDarkTheme}
                  step={step}
                />
              ))}
            </ol>
          </section>

          <MysteryEnvelopes
            isDarkTheme={isDarkTheme}
            items={notificationPreviewItems}
            onNavigate={onNavigate}
          />
        </div>

        <aside className="space-y-5">
          <OwnerExchangeHealth
            drawDone={Boolean(focusGroup?.hasDrawn)}
            healthRows={healthRows}
            isDarkTheme={isDarkTheme}
          />
        </aside>
      </div>

      <MemoryBookPreview
        groups={groups}
        isDarkTheme={isDarkTheme}
        mutedTextClass={mutedTextClass}
        onNavigate={onNavigate}
        pastPreviewGroups={pastPreviewGroups}
      />
    </section>
  );
}
