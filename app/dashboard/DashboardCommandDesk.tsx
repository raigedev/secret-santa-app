"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import {
  ArrowRightIcon,
  ChatIcon,
  GiftIcon,
  PlusIcon,
  SantaMarkIcon,
  WishlistIcon,
} from "./dashboard-icons";
import {
  formatDashboardBudget,
  formatDashboardDate,
} from "./dashboard-formatters";
import {
  ExchangeLedger,
  HelperRail,
  MiniStat,
  SectionTitle,
  StatusChip,
  getStatusChipClass,
  getSoftClass,
  plural,
  type StatusChipTone,
} from "./DashboardCommandDeskSections";
import InviteCard from "./InviteCard";
import type { DashboardActivityItem, Group, PendingInvite } from "./dashboard-types";

type DeskStep = {
  helper: string;
  id: string;
  label: string;
  status: "done" | "current" | "locked" | "attention";
};

type DashboardTaskRow = {
  actionAriaLabel?: string;
  detail: string;
  icon: ReactNode;
  label: string;
  onAction?: () => void;
  tone: StatusChipTone;
  value: string;
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
  pendingWorkCount: number;
  readinessPercent: number;
  readyGiftCount: number;
  revealMessage: string;
  unreadPrivateUpdateCount: number;
  wishlistItemCount: number;
  wishlistPercent: number;
  wishlistTarget: number;
  onCreateGroup: () => void;
  onOpenChat: () => void;
  onOpenGiftProgress: () => void;
  onOpenGroup: (groupId: string) => void;
  onOpenGroups: () => void;
  onOpenPath: (path: string) => void;
  onOpenWishlist: () => void;
};

function getPanelClass(isDarkTheme: boolean): string {
  return isDarkTheme
    ? "border border-slate-700/60 bg-slate-900/55 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_22px_52px_rgba(0,0,0,.18)]"
    : "border border-white/70 bg-white/52 text-[#2e3432] shadow-[inset_0_1px_0_rgba(255,255,255,.78),0_24px_68px_rgba(72,102,78,.07)]";
}

function getStepClass(step: DeskStep, isDarkTheme: boolean): string {
  if (step.status === "done") return "bg-[#48664e] text-white";
  if (step.status === "attention") return "border-4 border-[#a43c3f] bg-white text-[#a43c3f]";
  if (step.status === "current") return "border-4 border-[#48664e] bg-white text-[#48664e]";
  return isDarkTheme ? "bg-slate-800 text-slate-500" : "bg-[#dfe4e1] text-slate-400";
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
  pendingWorkCount,
  readinessPercent,
  readyGiftCount,
  revealMessage,
  unreadPrivateUpdateCount,
  wishlistItemCount,
  wishlistPercent,
  wishlistTarget,
  onCreateGroup,
  onOpenChat,
  onOpenGiftProgress,
  onOpenGroup,
  onOpenGroups,
  onOpenPath,
  onOpenWishlist,
}: DashboardCommandDeskProps) {
  const nextGroups = groups
    .slice()
    .sort((left, right) => new Date(left.event_date).getTime() - new Date(right.event_date).getTime())
    .slice(0, 3);
  const totalInviteBase = Math.max(memberCount + pendingInvites.length, memberCount, 1);
  const budgetLabel = focusGroup
    ? formatDashboardBudget(focusGroup.budget, focusGroup.currency) || "No budget"
    : "Choose budget";
  const giftDayLabel = focusGroup ? formatDashboardDate(focusGroup.event_date) : "Pick a date";
  const sealText = focusGroup?.hasDrawn ? "Names drawn, keep gifts moving" : "Ready for draw when everyone joins";
  const actionTarget = focusGroup ? () => onOpenPath(nextActionHref) : onCreateGroup;
  const statsClass = isDarkTheme ? "text-slate-400" : "text-slate-600";
  const visibleSteps = missionSteps.length > 0 ? missionSteps : [];
  const readinessNote = focusGroup?.hasDrawn
    ? "Names are drawn. Keep wishlist clues, shopping, and gift progress moving."
    : "Draw stays locked until invites and wishlist clues are ready.";
  const helperNote = focusGroup?.hasDrawn
    ? "Names are drawn. Keep your gift plan moving without exposing private details."
    : "Keep the draw locked until everyone joins and has at least one wishlist clue.";

  const taskRows: DashboardTaskRow[] = [
    {
      detail: pendingInvites.length > 0
        ? "Accept or decline pending invites without exposing email addresses."
        : "No invite replies need your attention right now.",
      icon: <GiftIcon className="h-5 w-5" />,
      label: pendingInvites.length > 0
        ? `${plural(pendingInvites.length, "invite")} waiting.`
        : "Invites are quiet.",
      tone: pendingInvites.length > 0 ? "red" : "green",
      value: pendingInvites.length > 0 ? "Needs reply" : "Clear",
    },
    {
      detail: wishlistItemCount < wishlistTarget
        ? "Add a few more clues so your Santa has options."
        : "Your Santa has enough clues to start planning.",
      icon: <WishlistIcon className="h-5 w-5" />,
      label: wishlistItemCount < wishlistTarget
        ? `Your wishlist has ${plural(wishlistItemCount, "clue")}.`
        : "Wishlist clues are ready.",
      tone: wishlistItemCount < wishlistTarget ? "gold" : "green",
      value: wishlistItemCount < wishlistTarget ? "Ready soon" : "Ready",
    },
    {
      detail: unreadPrivateUpdateCount > 0
        ? "Open your private threads from Messages when you are ready."
        : "No new secret thread activity needs your attention right now.",
      icon: <ChatIcon className="h-5 w-5" />,
      label: unreadPrivateUpdateCount > 0
        ? `${plural(unreadPrivateUpdateCount, "private message")} waiting.`
        : "Private messages are quiet.",
      onAction: unreadPrivateUpdateCount > 0 ? onOpenChat : undefined,
      actionAriaLabel: "Open private message threads",
      tone: unreadPrivateUpdateCount > 0 ? "red" : "quiet",
      value: unreadPrivateUpdateCount > 0 ? "Open" : "Private",
    },
  ];

  const quickActions = [
    {
      detail: pendingInvites.length > 0 ? "Only pending members." : "No pending replies.",
      icon: <PlusIcon />,
      label: "Invite reminder",
      onClick: onOpenGroups,
    },
    { detail: "Give Santa options.", icon: <WishlistIcon />, label: "Add wishlist clue", onClick: onOpenWishlist },
    { detail: "Grouped by exchange.", icon: <ChatIcon />, label: "Private threads", onClick: onOpenChat },
    { detail: `${readyGiftCount}/${Math.max(giftProgressTotal, 1)} ready`, icon: <GiftIcon />, label: "Gift progress", onClick: onOpenGiftProgress },
  ];

  return (
    <div data-fade className={`min-w-0 space-y-8 overflow-hidden ${isDarkTheme ? "text-slate-100" : "text-[#2e3432]"}`}>
      <section className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#7b5902]">Dashboard pulse</p>
          <h1 className={`mt-2 max-w-full break-words font-[var(--app-display-font)] text-[2rem] font-black leading-none tracking-tight [overflow-wrap:anywhere] sm:text-[2.45rem] ${isDarkTheme ? "text-white" : "text-[#174f2c]"}`}>
            Exchange at a glance
          </h1>
          <p className={`mt-3 max-w-3xl text-[17px] font-extrabold leading-7 ${statsClass}`}>{revealMessage}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip>{plural(groups.length, "active exchange")}</StatusChip>
          <StatusChip tone={pendingWorkCount > 0 ? "red" : "green"}>{plural(pendingWorkCount, "update")}</StatusChip>
          <StatusChip>{wishlistPercent}% wishlist ready</StatusChip>
        </div>
      </section>

      <article className={`relative overflow-hidden rounded-[40px] backdrop-blur-xl ${getPanelClass(isDarkTheme)}`}>
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_84%_10%,rgba(252,206,114,.28),transparent_28%),repeating-linear-gradient(90deg,transparent_0_96px,rgba(72,102,78,.045)_96px_97px)]" />
        <div className="relative grid gap-7 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#7b5902]">Active exchange desk</p>
            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-4">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-white/80 shadow-[0_14px_28px_rgba(72,102,78,.12)]">
                <SantaMarkIcon size={48} />
              </span>
              <h2 className={`min-w-0 max-w-full break-words font-[var(--app-display-font)] text-[44px] font-black leading-none [overflow-wrap:anywhere] sm:text-[54px] ${isDarkTheme ? "text-white" : "text-[#48664e]"}`}>
                {focusGroup?.name || "Start your first exchange"}
              </h2>
              {focusGroup?.isOwner ? <StatusChip tone="gold">Owner</StatusChip> : null}
            </div>
            <p className={`mt-4 max-w-3xl text-[17px] font-extrabold leading-7 ${statsClass}`}>{missionSummary}</p>
            <div className="mt-6 grid gap-4 border-y border-[rgba(215,166,63,.28)] py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <strong className={`block max-w-2xl break-words font-[var(--app-display-font)] text-[27px] font-black leading-tight [overflow-wrap:anywhere] ${isDarkTheme ? "text-white" : "text-slate-950"}`}>
                  Next best move: {nextActionLabel.toLowerCase()}.
                </strong>
                <span className={`mt-2 block max-w-2xl text-sm font-extrabold leading-6 ${statsClass}`}>
                  Private exchange details stay separated by group. No email names or private thread previews are shown here.
                </span>
              </div>
              <button type="button" onClick={actionTarget} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[#48664e] px-6 text-sm font-black text-white shadow-[0_18px_34px_rgba(72,102,78,.22)] transition hover:-translate-y-0.5">
                {nextActionLabel}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative min-h-57.5">
            <div className="absolute right-3 top-3 grid h-28 w-28 rotate-[7deg] place-items-center rounded-full border border-[#d7a63f]/30 bg-[#fff4d4]/70 px-4 text-center text-[12px] font-black leading-4 text-[#7b5902]">
              {sealText}
            </div>
            <Image className="absolute bottom-0 right-0 h-auto w-72.5 drop-shadow-[0_22px_24px_rgba(72,102,78,.14)]" src="/secret-santa-gifts-cropped.png" width={340} height={170} alt="Wrapped Secret Santa gifts" priority />
          </div>
        </div>
        <div className="relative grid border-t border-[rgba(72,102,78,.14)] bg-white/34 sm:grid-cols-4">
          {visibleSteps.map((step, index) => (
            <div key={step.id} className="min-h-28 border-b border-[rgba(72,102,78,.12)] p-5 sm:border-b-0 sm:border-r last:border-r-0">
              <span className={`grid h-11 w-11 place-items-center rounded-full text-[12px] font-black ${getStepClass(step, isDarkTheme)}`}>
                {step.status === "done" ? "OK" : index + 1}
              </span>
              <strong className="mt-3 block font-[var(--app-display-font)] text-[19px] font-black leading-none">{step.label}</strong>
              <span className={`mt-2 block text-[12px] font-extrabold leading-5 ${statsClass}`}>{step.helper}</span>
            </div>
          ))}
        </div>
        <div className="relative grid gap-6 border-t border-[rgba(72,102,78,.14)] bg-white/30 p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,.95fr)]">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#48664e]">Useful shortcuts</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <button key={action.label} type="button" onClick={action.onClick} className={`min-h-24 rounded-[22px] p-4 text-left transition hover:-translate-y-0.5 ${getSoftClass(isDarkTheme)}`}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#48664e]/12 text-[#48664e]">{action.icon}</span>
                  <strong className="mt-3 block text-[13px] font-black leading-tight">{action.label}</strong>
                  <span className={`mt-1 block text-[12px] font-extrabold leading-4 ${statsClass}`}>{action.detail}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-[rgba(72,102,78,.14)] pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#48664e]">Readiness meter</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MiniStat isDarkTheme={isDarkTheme} label="members joined" value={`${memberCount}/${totalInviteBase}`} />
              <MiniStat isDarkTheme={isDarkTheme} label="wishlist ready" value={`${wishlistPercent}%`} />
              <MiniStat isDarkTheme={isDarkTheme} label="gifts ready" value={`${readyGiftCount}/${Math.max(giftProgressTotal, 1)}`} />
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#dfe7df]"><span className="block h-full rounded-full bg-[#48664e]" style={{ width: `${readinessPercent}%` }} /></div>
            <p className={`mt-3 text-[12px] font-extrabold leading-5 ${statsClass}`}>{readinessNote}</p>
          </div>
        </div>
      </article>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-8">
          <div>
            <SectionTitle isDarkTheme={isDarkTheme} kicker="Plain tasks, privacy-safe status, and the few actions that keep this exchange moving.">Today&apos;s exchange flow</SectionTitle>
            <div className="divide-y divide-[rgba(72,102,78,.14)]">
              {taskRows.map((row) => (
                <div key={row.label} className="grid min-h-28 grid-cols-[54px_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[54px_minmax(0,1fr)_auto] sm:items-center">
                  <span className="grid h-13 w-13 place-items-center rounded-[20px] bg-[#48664e]/10 text-[#48664e]">{row.icon}</span>
                  <span className="min-w-0">
                    <strong className="block break-words font-[var(--app-display-font)] text-[23px] font-black leading-tight [overflow-wrap:anywhere]">{row.label}</strong>
                    <span className={`mt-1 block text-sm font-extrabold leading-6 ${statsClass}`}>{row.detail}</span>
                  </span>
                  <span className="col-start-2 justify-self-start sm:col-start-auto sm:justify-self-end">
                    {row.onAction ? (
                      <button
                        type="button"
                        onClick={row.onAction}
                        aria-label={row.actionAriaLabel}
                        className={`${getStatusChipClass(row.tone)} min-h-11 cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(164,60,63,.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a43c3f]`}
                      >
                        {row.value}
                      </button>
                    ) : (
                      <StatusChip tone={row.tone}>{row.value}</StatusChip>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {pendingInvites.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingInvites.map((invite) => (
                <InviteCard key={invite.group_id} description={invite.group_description} eventDate={invite.group_event_date} groupId={invite.group_id} groupName={invite.group_name} requiresAnonymousNickname={invite.require_anonymous_nickname} />
              ))}
            </div>
          ) : null}
          <ExchangeLedger groups={nextGroups} isDarkTheme={isDarkTheme} onOpenGroup={onOpenGroup} onOpenGroups={onOpenGroups} />
        </div>
        <HelperRail activityFeedItems={activityFeedItems} budgetLabel={budgetLabel} focusGroup={focusGroup} giftDayLabel={giftDayLabel} helperNote={helperNote} isDarkTheme={isDarkTheme} pendingInvites={pendingInvites.length} unreadPrivateUpdateCount={unreadPrivateUpdateCount} onOpenPath={onOpenPath} />
      </section>
    </div>
  );
}
