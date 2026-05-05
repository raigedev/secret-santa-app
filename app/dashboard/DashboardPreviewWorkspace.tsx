"use client";
import { buildExchangeLifecycleSummary } from "@/lib/exchange-lifecycle";
import {
  formatDashboardBudget,
  formatDashboardDate,
  getGiftProgressStepIndex,
} from "./dashboard-formatters";
import { ArrowRightIcon, GiftIcon, UserOutlineIcon } from "./dashboard-icons";
import {
  GiftProgressCard,
  HealthCard,
  type HealthRow,
  QuickActionsCard,
  RecentChangesCard,
  SectionHeader,
  ShoppingIdeasCard,
  UpcomingDatesCard,
  WishlistProgressCard,
  getPanelClass,
  getSoftPanelClass,
} from "./DashboardPreviewWorkspaceParts";
import InviteCard from "./InviteCard";
import type { DashboardActivityItem, GiftProgressSummary, Group, PendingInvite } from "./dashboard-types";
type DashboardPreviewWorkspaceProps = {
  activityFeedItems: DashboardActivityItem[];
  countdownNow: number;
  displayFirstName: string;
  giftProgressSummary: GiftProgressSummary | null;
  groups: Group[];
  hasAssignments: boolean;
  isDarkTheme: boolean;
  pendingInvites: PendingInvite[];
  recipientCount: number;
  revealMessage: string;
  unreadNotificationCount: number;
  wishlistItemCount: number;
  onCreateGroup: () => void;
  onOpenChat: () => void;
  onOpenGiftProgress: () => void;
  onOpenGroup: (groupId: string) => void;
  onOpenGroups: () => void;
  onOpenPath: (path: string) => void;
  onOpenSecretSanta: () => void;
  onOpenWishlist: () => void;
};

function getGroupEventTime(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getFocusGroup(groups: Group[]): Group | null {
  return [...groups].sort(
    (left, right) => getGroupEventTime(left.event_date) - getGroupEventTime(right.event_date)
  )[0] || null;
}

function getPercent(value: number, total: number): number {
  return total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100));
}

function getGroupPhaseLabel(group: Group): string {
  return group.hasDrawn ? "In progress" : group.isOwner ? "Setup" : "Joined";
}

function DashboardSummaryPill({
  isDarkTheme,
  label,
  value,
}: {
  isDarkTheme: boolean;
  label: string;
  value: string;
}) {
  return (
    <span
      className={`inline-flex min-h-13 min-w-35.5 items-center justify-center gap-2 rounded-full px-4 text-center shadow-[0_12px_28px_rgba(46,52,50,.05)] ring-1 transition hover:-translate-y-0.5 sm:min-w-39 ${
        isDarkTheme
          ? "bg-slate-800/90 text-slate-100 ring-slate-700"
          : "bg-white/92 text-[#48664e] ring-[rgba(72,102,78,.13)]"
      }`}
    >
      <strong className="text-[18px] font-black leading-none tracking-tight sm:text-[20px]">
        {value}
      </strong>
      <span
        className={`text-[12px] font-black leading-4 sm:text-[13px] ${
          isDarkTheme ? "text-slate-300" : "text-[#48664e]"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

export function DashboardPreviewWorkspace({
  activityFeedItems,
  countdownNow,
  displayFirstName,
  giftProgressSummary,
  groups,
  hasAssignments,
  isDarkTheme,
  pendingInvites,
  recipientCount,
  revealMessage,
  unreadNotificationCount,
  wishlistItemCount,
  onCreateGroup,
  onOpenChat,
  onOpenGiftProgress,
  onOpenGroup,
  onOpenGroups,
  onOpenPath,
  onOpenSecretSanta,
  onOpenWishlist,
}: DashboardPreviewWorkspaceProps) {
  const focusGroup = getFocusGroup(groups);
  const nextGroups = groups
    .slice()
    .sort((left, right) => getGroupEventTime(left.event_date) - getGroupEventTime(right.event_date))
    .slice(0, 3);
  const memberCount = focusGroup?.members.length || 0;
  const readyGiftCount = giftProgressSummary?.readyToGiveCount || 0;
  const giftProgressTotal = giftProgressSummary?.totalAssignments || recipientCount;
  const wishlistTarget = Math.max(5, wishlistItemCount);
  const wishlistPercent = getPercent(Math.min(wishlistItemCount, wishlistTarget), wishlistTarget);
  const lifecycle = buildExchangeLifecycleSummary(
    {
      acceptedCount: memberCount,
      eventDate: focusGroup?.event_date || null,
      giftProgressTotal,
      hasDrawn: Boolean(focusGroup?.hasDrawn || recipientCount > 0),
      isOwner: Boolean(focusGroup?.isOwner),
      memberCount,
      pendingInviteCount: pendingInvites.length,
      readyGiftCount,
      recipientCount,
      wishlistItemCount,
    },
    countdownNow
  );
  const missionSteps = lifecycle.steps.filter((step) =>
    ["setup", "invites", "draw", "giftDay"].includes(step.id)
  );
  const nextActionLabel = focusGroup ? lifecycle.nextAction.label : "Create exchange";
  const nextActionHref = focusGroup ? lifecycle.nextAction.href : "/create-group";
  const missionSummary = !focusGroup
    ? "Create a group, set the gift day and budget, then invite members."
    : pendingInvites.length > 0
      ? "Finish invite confirmations so everyone is ready for the draw."
      : focusGroup.hasDrawn
        ? "Names are drawn. Keep wishlist, shopping, and gift progress moving."
        : "Review the setup, wishlists, and draw readiness for this exchange.";
  const healthRows: HealthRow[] = [
    {
      label: "Invites accepted",
      percent: getPercent(memberCount, memberCount + pendingInvites.length),
      value: `${memberCount}/${memberCount + pendingInvites.length || memberCount}`,
    },
    {
      label: "Wishlists filled",
      percent: wishlistPercent,
      value: `${wishlistItemCount}/${wishlistTarget}`,
    },
    {
      label: "Draw readiness",
      percent: focusGroup?.hasDrawn ? 100 : getPercent(memberCount, memberCount + pendingInvites.length),
      tone: focusGroup?.hasDrawn ? undefined : "gold",
      value: focusGroup?.hasDrawn ? "Ready" : `${memberCount}/${memberCount + pendingInvites.length || memberCount}`,
    },
    {
      label: "Gift confirmations",
      percent: getPercent(readyGiftCount, giftProgressTotal),
      tone: readyGiftCount > 0 ? undefined : "quiet",
      value: `${readyGiftCount}/${giftProgressTotal}`,
    },
  ];
  const activeGiftStepIndex = getGiftProgressStepIndex(giftProgressSummary?.focusStep || "planning");
  const pendingWorkCount = pendingInvites.length + unreadNotificationCount;
  const mutedTextClass = isDarkTheme ? "text-slate-400" : "text-slate-600";
  const chipClass = isDarkTheme ? "bg-slate-800 text-slate-300" : "bg-[#eef4ef] text-[#48664e]";

  return (
    <div data-fade className="min-w-0 space-y-5 overflow-hidden">
      <section className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className={`max-w-full break-words text-[2.25rem] font-black leading-none tracking-tight [overflow-wrap:anywhere] sm:text-[3.35rem] ${isDarkTheme ? "text-white" : "text-[#174f2c]"}`}>
            Welcome back, {displayFirstName}
          </h1>
          <p className={`mt-3 max-w-3xl text-[17px] font-extrabold leading-7 ${mutedTextClass}`}>
            {revealMessage}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
          <DashboardSummaryPill
            isDarkTheme={isDarkTheme}
            label={`active exchange${groups.length === 1 ? "" : "s"}`}
            value={String(groups.length)}
          />
          <DashboardSummaryPill
            isDarkTheme={isDarkTheme}
            label={`update${pendingWorkCount === 1 ? "" : "s"}`}
            value={String(pendingWorkCount)}
          />
          <DashboardSummaryPill
            isDarkTheme={isDarkTheme}
            label="wishlist ready"
            value={`${wishlistPercent}%`}
          />
        </div>
      </section>

      <section className="grid min-w-0 items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-5">
          <section id="dashboard-groups" className={`min-w-0 scroll-mt-24 overflow-hidden rounded-[30px] p-5 sm:p-6 ${getPanelClass(isDarkTheme)}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 gap-4">
                <span className="hidden h-15 w-15 shrink-0 items-center justify-center rounded-[22px] bg-[#48664e] text-white shadow-[0_14px_28px_rgba(72,102,78,.22)] sm:flex">
                  <GiftIcon className="h-7 w-7" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7b5902]">Your next step</p>
                  <h2 className="mt-2 max-w-full break-words text-[24px] font-black leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-[27px]">
                    {focusGroup?.name || "Start your first exchange"}
                  </h2>
                  <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-black ${mutedTextClass}`}>
                    <span>Budget: {focusGroup ? formatDashboardBudget(focusGroup.budget, focusGroup.currency) || "No budget" : "Choose later"}</span>
                    <span>Gift day: {focusGroup ? formatDashboardDate(focusGroup.event_date) : "Pick a date"}</span>
                    <span>{memberCount} member{memberCount === 1 ? "" : "s"}</span>
                  </div>
                  <p className={`mt-2 max-w-3xl text-[14px] font-bold leading-6 ${mutedTextClass}`}>
                    {missionSummary}
                  </p>
                </div>
              </div>
              <div className="grid w-full gap-2 sm:w-auto sm:grid-flow-col">
                <button type="button" onClick={() => onOpenPath(nextActionHref)} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-[#48664e] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(72,102,78,.2)] transition hover:-translate-y-0.5">
                  {nextActionLabel}
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
                <button type="button" onClick={onOpenGroups} className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-full px-5 text-sm font-black transition hover:-translate-y-0.5 ${isDarkTheme ? "bg-slate-800 text-slate-100" : "bg-white text-[#48664e] ring-1 ring-[rgba(72,102,78,.14)]"}`}>
                  My Groups
                </button>
              </div>
            </div>

            <ol className="relative mt-8 grid gap-4 sm:grid-cols-4">
              <span className={`absolute left-10 right-10 top-6 hidden h-0.75 rounded-full sm:block ${isDarkTheme ? "bg-slate-800" : "bg-[#e1e6e1]"}`} />
              {missionSteps.map((step, index) => (
                <li key={step.id} className="relative z-10 text-center">
                  <span className={`mx-auto flex h-13 w-13 items-center justify-center rounded-full text-sm font-black ${
                    step.status === "done"
                      ? "bg-[#48664e] text-white"
                      : step.status === "current" || step.status === "attention"
                        ? "border-4 border-[#48664e] bg-white text-[#48664e]"
                        : isDarkTheme
                          ? "bg-slate-800 text-slate-500"
                          : "bg-[#dfe4e1] text-slate-400"
                  }`}>
                    {step.status === "done" ? "OK" : index + 1}
                  </span>
                  <strong className={`mt-3 block text-[13px] ${step.status === "locked" ? "text-slate-400" : "text-[#48664e]"}`}>{step.label}</strong>
                  <span className={`mt-1 block text-[12px] font-bold ${mutedTextClass}`}>{step.helper}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className={`min-w-0 overflow-hidden rounded-[30px] p-5 sm:p-6 ${getPanelClass(isDarkTheme)}`}>
            <SectionHeader
              action={<button type="button" onClick={onOpenGroups} className="text-[12px] font-black text-[#a43c3f]">View all</button>}
              isDarkTheme={isDarkTheme}
              title="Active exchanges"
            >
              Current groups only. Concluded exchanges stay in History.
            </SectionHeader>
            {nextGroups.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {nextGroups.map((group) => (
                  <button key={group.id} type="button" onClick={() => onOpenGroup(group.id)} className={`min-h-36 min-w-0 rounded-[22px] p-4 text-left transition hover:-translate-y-0.5 ${getSoftPanelClass(isDarkTheme)}`}>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${group.isOwner ? "bg-[#48664e] text-white" : "bg-[#a43c3f]/12 text-[#a43c3f]"}`}>
                      {group.isOwner ? <GiftIcon /> : <UserOutlineIcon className="h-5 w-5" />}
                    </span>
                    <strong className="mt-3 block break-words text-[15px] font-black [overflow-wrap:anywhere]">{group.name}</strong>
                    <span className={`mt-1 block text-[12px] font-bold ${mutedTextClass}`}>Gift day: {formatDashboardDate(group.event_date)}</span>
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${chipClass}`}>{formatDashboardBudget(group.budget, group.currency) || "No budget"}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${chipClass}`}>{group.members.length} members</span>
                      <span className="rounded-full bg-[#fff0cc] px-2.5 py-1 text-[11px] font-black text-[#7b5902]">{getGroupPhaseLabel(group)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={`rounded-3xl border border-dashed p-6 ${isDarkTheme ? "border-slate-700 bg-slate-950/35" : "border-[rgba(72,102,78,.18)] bg-[#f7faf5]"}`}>
                <h3 className="text-xl font-black">No active exchange yet</h3>
                <p className={`mt-2 max-w-2xl text-sm font-bold leading-6 ${mutedTextClass}`}>
                  Create your first exchange or accept an invite. Old test groups and concluded exchanges should not appear here.
                </p>
                <button type="button" onClick={onCreateGroup} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#48664e] px-5 text-sm font-black text-white">
                  Create exchange
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>

          {pendingInvites.length > 0 && (
            <section className="grid gap-4 md:grid-cols-2">
              {pendingInvites.map((invite) => (
                <InviteCard
                  key={invite.group_id}
                  description={invite.group_description}
                  eventDate={invite.group_event_date}
                  groupId={invite.group_id}
                  groupName={invite.group_name}
                  requiresAnonymousNickname={invite.require_anonymous_nickname}
                />
              ))}
            </section>
          )}

          <section className="grid gap-5 lg:grid-cols-2">
            <WishlistProgressCard isDarkTheme={isDarkTheme} wishlistItemCount={wishlistItemCount} wishlistPercent={wishlistPercent} onOpenWishlist={onOpenWishlist} />
            <GiftProgressCard activeStepIndex={activeGiftStepIndex} isDarkTheme={isDarkTheme} onOpenGiftProgress={onOpenGiftProgress} />
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <UpcomingDatesCard countdownNow={countdownNow} focusGroup={focusGroup} isDarkTheme={isDarkTheme} onOpenGroups={onOpenGroups} />
          <QuickActionsCard hasAssignments={hasAssignments} isDarkTheme={isDarkTheme} onCreateGroup={onCreateGroup} onOpenChat={onOpenChat} onOpenSecretSanta={onOpenSecretSanta} onOpenWishlist={onOpenWishlist} />
          <HealthCard healthRows={healthRows} isDarkTheme={isDarkTheme} />
          <ShoppingIdeasCard isDarkTheme={isDarkTheme} onOpenPath={onOpenPath} />
        </aside>
      </section>

      <RecentChangesCard activityFeedItems={activityFeedItems} isDarkTheme={isDarkTheme} onOpenPath={onOpenPath} />
    </div>
  );
}
