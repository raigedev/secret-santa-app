"use client";

import type { ReactNode } from "react";
import { formatDashboardDate } from "./dashboard-formatters";
import { SantaMarkIcon } from "./dashboard-icons";
import type { DashboardActivityItem, Group } from "./dashboard-types";

export function plural(value: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

export function getSoftClass(isDarkTheme: boolean): string {
  return isDarkTheme
    ? "border border-slate-700/50 bg-slate-800/42"
    : "border border-[rgba(72,102,78,.14)] bg-white/45";
}

export function StatusChip({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "gold" | "red" | "quiet";
}) {
  const className =
    tone === "red"
      ? "bg-[#a43c3f]/10 text-[#a43c3f]"
      : tone === "gold"
        ? "bg-[#fff3cf] text-[#7b5902]"
        : tone === "quiet"
          ? "bg-slate-200/70 text-slate-600"
          : "bg-[#eaf2ea] text-[#48664e]";

  return (
    <span className={`inline-flex min-h-9 items-center justify-center rounded-full px-4 text-[12px] font-black ${className}`}>
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  isDarkTheme = false,
  kicker,
}: {
  children: ReactNode;
  isDarkTheme?: boolean;
  kicker?: ReactNode;
}) {
  return (
    <div className="border-b border-[rgba(72,102,78,.14)] pb-4">
      <h2 className={`font-[var(--app-display-font)] text-[28px] font-black leading-none tracking-tight ${isDarkTheme ? "text-white" : "text-slate-950"}`}>
        {children}
      </h2>
      {kicker ? <p className={`mt-2 max-w-2xl text-[14px] font-extrabold leading-6 ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>{kicker}</p> : null}
    </div>
  );
}

export function MiniStat({
  isDarkTheme = false,
  label,
  value,
}: {
  isDarkTheme?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-[#d7a63f]/35 pb-3">
      <strong className={`block font-[var(--app-display-font)] text-[25px] font-black leading-none ${isDarkTheme ? "text-white" : "text-[#48664e]"}`}>{value}</strong>
      <span className={`mt-1 block text-[11px] font-black leading-4 ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>{label}</span>
    </div>
  );
}

export function ExchangeLedger({
  groups,
  isDarkTheme,
  onOpenGroup,
  onOpenGroups,
}: {
  groups: Group[];
  isDarkTheme: boolean;
  onOpenGroup: (groupId: string) => void;
  onOpenGroups: () => void;
}) {
  return (
    <div>
      <SectionTitle isDarkTheme={isDarkTheme} kicker="Active groups stay compact here, with enough detail to choose where to work next.">Exchange ledger</SectionTitle>
      <div className={`mt-4 overflow-hidden rounded-[28px] ${getSoftClass(isDarkTheme)}`}>
        <div className="hidden min-h-13 grid-cols-[minmax(0,1.3fr)_110px_110px_120px] items-center gap-4 border-b border-[rgba(72,102,78,.14)] px-5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 sm:grid">
          <span>Exchange</span>
          <span>Members</span>
          <span>Gift day</span>
          <span>Status</span>
        </div>
        {groups.length > 0 ? (
          groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onOpenGroup(group.id)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[rgba(72,102,78,.1)] px-5 py-4 text-left last:border-b-0 sm:min-h-18 sm:grid-cols-[minmax(0,1.3fr)_110px_110px_120px] sm:gap-4 sm:py-0"
            >
              <span className="min-w-0">
                <strong className="block truncate text-[14px] font-black">{group.name}</strong>
                <span className="text-[12px] font-bold text-slate-500">{group.isOwner ? "Owner workspace" : "Participant"}</span>
                <span className="mt-1 block text-[12px] font-bold text-slate-500 sm:hidden">
                  {plural(group.members.length, "member")} - {formatDashboardDate(group.event_date)}
                </span>
              </span>
              <span className="hidden sm:block">{plural(group.members.length, "member")}</span>
              <span className="hidden sm:block">{formatDashboardDate(group.event_date)}</span>
              <span className="justify-self-end sm:justify-self-start">
                <StatusChip tone={group.hasDrawn ? "green" : "gold"}>{group.hasDrawn ? "Drawn" : "Setup"}</StatusChip>
              </span>
            </button>
          ))
        ) : (
          <button type="button" onClick={onOpenGroups} className="min-h-20 w-full px-5 text-left text-sm font-extrabold text-slate-600">
            No active exchanges yet. Create or accept one to begin.
          </button>
        )}
      </div>
    </div>
  );
}

export function HelperRail({
  activityFeedItems,
  budgetLabel,
  focusGroup,
  giftDayLabel,
  helperNote,
  isDarkTheme,
  pendingInvites,
  unreadNotificationCount,
  onOpenPath,
}: {
  activityFeedItems: DashboardActivityItem[];
  budgetLabel: string;
  focusGroup: Group | null;
  giftDayLabel: string;
  helperNote: string;
  isDarkTheme: boolean;
  pendingInvites: number;
  unreadNotificationCount: number;
  onOpenPath: (path: string) => void;
}) {
  const updates = [
    pendingInvites > 0 ? `${plural(pendingInvites, "invite")} waiting.` : "Invites are clear.",
    unreadNotificationCount > 0 ? `${plural(unreadNotificationCount, "private update")} waiting.` : "Private messages are quiet.",
    activityFeedItems[0]?.title || "No recent changes need action.",
  ];

  return (
    <aside className="min-w-0 border-t border-[rgba(72,102,78,.14)] pt-6 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-[22px] bg-white/70">
          <SantaMarkIcon size={42} />
        </span>
        <span>
          <strong className="block font-[var(--app-display-font)] text-[23px] font-black leading-none">Santa helper</strong>
          <span className="mt-1 block text-[12px] font-extrabold text-slate-500">One calm helper, tied to this exchange.</span>
        </span>
      </div>
      <p className={`mt-4 border-b border-[rgba(72,102,78,.14)] pb-5 text-[13px] font-extrabold leading-6 ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>{helperNote}</p>
      <h3 className="mt-6 text-[12px] font-black uppercase tracking-[0.18em] text-[#48664e]">Gift timing</h3>
      <div className="mt-4 space-y-3 text-sm font-black">
        <div className="flex justify-between gap-4"><span className="text-slate-500">Draw opens</span><span>{focusGroup?.hasDrawn ? "Open" : "When ready"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-slate-500">Gift day</span><span>{giftDayLabel}</span></div>
        <div className="flex justify-between gap-4"><span className="text-slate-500">Budget</span><span>{budgetLabel}</span></div>
      </div>
      <h3 className="mt-7 text-[12px] font-black uppercase tracking-[0.18em] text-[#48664e]">Mystery envelopes</h3>
      <div className="mt-4 space-y-4">
        {updates.map((update) => (
          <div key={update} className="grid grid-cols-[9px_minmax(0,1fr)] gap-3">
            <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[#d7a63f]" />
            <strong className="text-[14px] leading-5">{update}</strong>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onOpenPath("/notifications")} className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full text-sm font-black ${getSoftClass(isDarkTheme)}`}>
        Open notification center
      </button>
    </aside>
  );
}
