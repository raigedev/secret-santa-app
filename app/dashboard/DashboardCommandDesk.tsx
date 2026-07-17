"use client";

import {
  ArrowRightIcon,
  ChatIcon,
  GiftIcon,
  UserOutlineIcon,
  WishlistIcon,
} from "./dashboard-icons";
import {
  AttentionRail,
  ExchangeLedger,
  SectionTitle,
  StatusChip,
  plural,
  type DashboardAttentionItem,
} from "./DashboardCommandDeskSections";
import {
  formatDashboardBudget,
  formatDashboardDate,
} from "./dashboard-formatters";
import InviteCard from "./InviteCard";
import type { DashboardActivityItem, Group, PendingInvite } from "./dashboard-types";

type DeskStep = {
  helper: string;
  id: string;
  label: string;
  status: "done" | "current" | "locked" | "attention";
};

type DashboardCommandDeskProps = {
  activityFeedItems: DashboardActivityItem[];
  focusGroup: Group | null;
  giftProgressTotal: number;
  groups: Group[];
  isDarkTheme: boolean;
  memberCount: number;
  missionSteps: DeskStep[];
  missionSummary: string;
  nextActionHref: string;
  nextActionLabel: string;
  pendingInvites: PendingInvite[];
  readinessPercent: number;
  readyGiftCount: number;
  revealMessage: string;
  unreadPrivateUpdateCount: number;
  wishlistItemCount: number;
  wishlistTarget: number;
  onCreateGroup: () => void;
  onOpenChat: () => void;
  onOpenGroup: (groupId: string) => void;
  onOpenGroups: () => void;
  onOpenPath: (path: string) => void;
};

function getPanelClass(isDarkTheme: boolean): string {
  return isDarkTheme
    ? "border border-slate-700/60 bg-slate-900/62 text-slate-100 shadow-[0_18px_48px_rgba(0,0,0,.16)]"
    : "border border-[rgba(72,102,78,.14)] bg-white/82 text-[#2e3432] shadow-[0_18px_48px_rgba(72,102,78,.06)]";
}

function getStepMarkerClass(step: DeskStep, isDarkTheme: boolean): string {
  if (step.status === "done") {
    return "bg-[#48664e] ring-[#48664e]/15";
  }

  if (step.status === "attention") {
    return "bg-[#a43c3f] ring-[#a43c3f]/15";
  }

  if (step.status === "current") {
    return "bg-[#d7a63f] ring-[#d7a63f]/18";
  }

  return isDarkTheme
    ? "bg-slate-600 ring-slate-600/15"
    : "bg-slate-300 ring-slate-300/20";
}

export function DashboardCommandDesk({
  activityFeedItems,
  focusGroup,
  giftProgressTotal,
  groups,
  isDarkTheme,
  memberCount,
  missionSteps,
  missionSummary,
  nextActionHref,
  nextActionLabel,
  pendingInvites,
  readinessPercent,
  readyGiftCount,
  revealMessage,
  unreadPrivateUpdateCount,
  wishlistItemCount,
  wishlistTarget,
  onCreateGroup,
  onOpenChat,
  onOpenGroup,
  onOpenGroups,
  onOpenPath,
}: DashboardCommandDeskProps) {
  const nextGroups = groups
    .slice()
    .sort((left, right) => new Date(left.event_date).getTime() - new Date(right.event_date).getTime())
    .slice(0, 3);
  const budgetLabel = focusGroup
    ? formatDashboardBudget(focusGroup.budget, focusGroup.currency) || "No budget"
    : "Choose budget";
  const giftDayLabel = focusGroup ? formatDashboardDate(focusGroup.event_date) : "Pick a date";
  const actionTarget = focusGroup ? () => onOpenPath(nextActionHref) : onCreateGroup;
  const supportingTextClass = isDarkTheme ? "text-slate-400" : "text-slate-600";
  const visibleSteps = missionSteps.length > 0 ? missionSteps : [];
  const wishlistCluesNeeded = Math.max(wishlistTarget - wishlistItemCount, 0);
  const wishlistNeedsClues = wishlistCluesNeeded > 0;
  const remainingGiftUpdates = Math.max(giftProgressTotal - readyGiftCount, 0);
  const nextActionDetail = !focusGroup
    ? "Set the gift day and budget, then invite your first members."
    : pendingInvites.length > 0
      ? `${plural(pendingInvites.length, "invite")} still need a response.`
      : wishlistNeedsClues
        ? wishlistItemCount === 0
          ? "Add at least one wishlist clue so your Santa has an idea to start with."
          : `Add ${plural(wishlistCluesNeeded, "more clue")} to make gift planning easier.`
        : !focusGroup.hasDrawn
          ? "Review the group and draw names when everyone is ready."
          : remainingGiftUpdates > 0
            ? `${plural(remainingGiftUpdates, "gift")} still need a progress update.`
            : "Your exchange is on track. Open it whenever you want the full details.";

  const attentionItems: DashboardAttentionItem[] = [];

  if (pendingInvites.length > 0) {
    attentionItems.push({
      actionLabel: "Review",
      detail: "Accept or decline from the invite section.",
      icon: <UserOutlineIcon className="h-5 w-5" />,
      label: `${plural(pendingInvites.length, "invite")} waiting`,
      onAction: () =>
        document
          .getElementById("dashboard-pending-invites")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      tone: "red",
    });
  }

  if (focusGroup && wishlistNeedsClues) {
    attentionItems.push({
      actionLabel: "Add ideas",
      detail:
        wishlistItemCount === 0
          ? "Your wishlist has no clues yet."
          : `${plural(wishlistCluesNeeded, "more clue")} would help.`,
      icon: <WishlistIcon className="h-5 w-5" />,
      label: "Wishlist needs clues",
      onAction: () => onOpenPath("/wishlist"),
      tone: "gold",
    });
  }

  if (unreadPrivateUpdateCount > 0) {
    attentionItems.push({
      actionLabel: "Open",
      detail: "Read them privately in Messages.",
      icon: <ChatIcon className="h-5 w-5" />,
      label: `${plural(unreadPrivateUpdateCount, "message")} waiting`,
      onAction: onOpenChat,
      tone: "red",
    });
  }

  if (focusGroup?.hasDrawn && remainingGiftUpdates > 0) {
    attentionItems.push({
      actionLabel: "Update",
      detail: "Keep your private gift plan current.",
      icon: <GiftIcon className="h-5 w-5" />,
      label: `${plural(remainingGiftUpdates, "gift")} need progress`,
      onAction: () => onOpenPath("/gift-tracking"),
      tone: "gold",
    });
  }

  return (
    <div
      data-fade
      data-testid="dashboard-command-desk"
      className={`min-w-0 space-y-6 overflow-hidden ${isDarkTheme ? "text-slate-100" : "text-[#2e3432]"}`}
    >
      <header data-testid="dashboard-page-heading" className="max-w-4xl">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7b5902]">
          Dashboard
        </p>
        <h1
          className={`mt-1.5 break-words font-[var(--app-display-font)] text-[30px] font-black leading-tight tracking-normal sm:text-[34px] ${
            isDarkTheme ? "text-white" : "text-[#2e3432]"
          }`}
        >
          Your exchange today
        </h1>
        <p className={`mt-2 max-w-3xl text-[15px] font-bold leading-6 ${supportingTextClass}`}>
          {revealMessage}
        </p>
      </header>

      <section
        data-testid="dashboard-workspace-grid"
        className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start"
      >
        <div data-testid="dashboard-primary-column" className="min-w-0 space-y-7">
          <article
            data-testid="dashboard-focus-panel"
            className={`min-w-0 overflow-hidden rounded-3xl ${getPanelClass(isDarkTheme)}`}
          >
            <header className="p-5 sm:p-7">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7b5902]">
                  Current exchange
                </p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
                  <h2
                    className={`min-w-0 break-words font-[var(--app-display-font)] text-[28px] font-black leading-tight [overflow-wrap:anywhere] sm:text-[34px] ${
                      isDarkTheme ? "text-white" : "text-[#48664e]"
                    }`}
                  >
                    {focusGroup?.name || "Start your first exchange"}
                  </h2>
                  {focusGroup?.isOwner ? <StatusChip tone="gold">Owner</StatusChip> : null}
                </div>
                <p className={`mt-2 max-w-3xl text-[15px] font-bold leading-6 ${supportingTextClass}`}>
                  {missionSummary}
                </p>
              </div>

              <dl
                data-testid="dashboard-exchange-metadata"
                className="mt-6 grid divide-y divide-[rgba(72,102,78,.12)] border-y border-[rgba(72,102,78,.12)] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
              >
                <div className="py-3.5 sm:px-4 sm:first:pl-0">
                  <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Members
                  </dt>
                  <dd className="mt-1 text-sm font-black">{plural(memberCount, "member")}</dd>
                </div>
                <div className="py-3.5 sm:px-4">
                  <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Gift day
                  </dt>
                  <dd className="mt-1 text-sm font-black">{giftDayLabel}</dd>
                </div>
                <div className="py-3.5 sm:px-4 sm:last:pr-0">
                  <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Budget
                  </dt>
                  <dd className="mt-1 text-sm font-black">{budgetLabel}</dd>
                </div>
              </dl>
            </header>

            <section className={`border-t border-[rgba(72,102,78,.14)] p-5 sm:p-7 ${isDarkTheme ? "bg-slate-800/38" : "bg-[#edf4ef]"}`}>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#48664e]">
                    Next step
                  </p>
                  <h3 className="mt-1 break-words font-[var(--app-display-font)] text-[22px] font-black leading-tight [overflow-wrap:anywhere]">
                    {nextActionLabel}
                  </h3>
                  <p className={`mt-1 text-sm font-bold leading-5 ${supportingTextClass}`}>
                    {nextActionDetail}
                  </p>
                </div>
                <button
                  data-testid="dashboard-primary-action"
                  type="button"
                  onClick={actionTarget}
                  className="gift-button gift-button-primary min-h-11 w-full px-5 text-sm sm:w-auto"
                >
                  {nextActionLabel}
                  <span className="gift-button-icon" aria-hidden="true">
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </button>
              </div>
            </section>

            <section
              data-testid="dashboard-lifecycle"
              className="border-t border-[rgba(72,102,78,.14)] p-5 sm:p-7"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#48664e]">
                    Exchange progress
                  </p>
                  <h3 className="mt-1 font-[var(--app-display-font)] text-xl font-black">
                    {readinessPercent}% ready
                  </h3>
                </div>
                <span className={`text-xs font-bold ${supportingTextClass}`}>
                  Setup, invites, draw, and gift day
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Exchange readiness"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={readinessPercent}
                className={`mt-4 h-2 overflow-hidden rounded-full ${isDarkTheme ? "bg-slate-700" : "bg-[#dfe7df]"}`}
              >
                <span
                  className="block h-full rounded-full bg-[#48664e] transition-[width]"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
              <ol className="mt-5 grid gap-4 sm:grid-cols-4">
                {visibleSteps.map((step) => (
                  <li
                    key={step.id}
                    data-testid="dashboard-lifecycle-step"
                    data-status={step.status}
                    className="grid grid-cols-[12px_minmax(0,1fr)] gap-3 border-l border-[rgba(72,102,78,.14)] pl-3 sm:block sm:border-l-0 sm:border-t sm:pl-0 sm:pt-4"
                  >
                    <span
                      className={`mt-1.5 block h-2.5 w-2.5 rounded-full ring-4 sm:mt-0 ${getStepMarkerClass(step, isDarkTheme)}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 sm:mt-3 sm:block">
                      <strong className="block text-sm font-black">{step.label}</strong>
                      <span className={`mt-0.5 block text-xs font-bold leading-4 ${supportingTextClass}`}>
                        {step.helper}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </article>

          {pendingInvites.length > 0 ? (
            <section id="dashboard-pending-invites" className="scroll-mt-24">
              <SectionTitle
                isDarkTheme={isDarkTheme}
                kicker="Respond here without exposing private email details."
              >
                Invites waiting for you
              </SectionTitle>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
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
              </div>
            </section>
          ) : null}

          <ExchangeLedger
            groups={nextGroups}
            isDarkTheme={isDarkTheme}
            onOpenGroup={onOpenGroup}
            onOpenGroups={onOpenGroups}
          />
        </div>

        <AttentionRail
          activityFeedItems={activityFeedItems}
          attentionItems={attentionItems}
          budgetLabel={budgetLabel}
          focusGroup={focusGroup}
          giftDayLabel={giftDayLabel}
          isDarkTheme={isDarkTheme}
          onOpenPath={onOpenPath}
        />
      </section>
    </div>
  );
}
