"use client";

import type { ReactNode } from "react";
import { formatDashboardDate } from "./dashboard-formatters";
import { ArrowRightIcon } from "./dashboard-icons";
import type { DashboardActivityItem, Group } from "./dashboard-types";

export type StatusChipTone = "green" | "gold" | "red" | "quiet";

export type DashboardAttentionItem = {
  actionLabel: string;
  detail: string;
  icon: ReactNode;
  label: string;
  onAction: () => void;
  tone: StatusChipTone;
};

export function plural(value: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

function getSoftClass(isDarkTheme: boolean): string {
  return isDarkTheme
    ? "border border-slate-700/60 bg-slate-900/55"
    : "border border-[rgba(72,102,78,.14)] bg-white/72";
}

export function getStatusChipClass(tone: StatusChipTone = "green"): string {
  const className =
    tone === "red"
      ? "bg-[#a43c3f]/10 text-[#a43c3f]"
      : tone === "gold"
        ? "bg-[#fff3cf] text-[#7b5902]"
        : tone === "quiet"
          ? "bg-slate-200/70 text-slate-600"
          : "bg-[#eaf2ea] text-[#48664e]";

  return `inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded-full px-3 text-[11px] font-black ${className}`;
}

export function StatusChip({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: StatusChipTone;
}) {
  return <span className={getStatusChipClass(tone)}>{children}</span>;
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
      <h2
        className={`font-[var(--app-display-font)] text-2xl font-black leading-tight tracking-normal ${
          isDarkTheme ? "text-white" : "text-[#2e3432]"
        }`}
      >
        {children}
      </h2>
      {kicker ? (
        <p
          className={`mt-1.5 max-w-2xl text-sm font-bold leading-6 ${
            isDarkTheme ? "text-slate-400" : "text-slate-600"
          }`}
        >
          {kicker}
        </p>
      ) : null}
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
    <section data-testid="dashboard-exchange-ledger">
      <SectionTitle
        isDarkTheme={isDarkTheme}
        kicker="Choose another exchange to check its gift details."
      >
        Active exchanges
      </SectionTitle>
      <div className={`mt-4 overflow-hidden rounded-3xl ${getSoftClass(isDarkTheme)}`}>
        <div className="hidden min-h-12 grid-cols-[minmax(0,1.3fr)_100px_120px_96px] items-center gap-4 border-b border-[rgba(72,102,78,.14)] px-5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 sm:grid">
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
              aria-label={`Open ${group.name}`}
              onClick={() => onOpenGroup(group.id)}
              className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[rgba(72,102,78,.1)] px-5 py-4 text-left transition last:border-b-0 hover:bg-[#48664e]/6 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#48664e] sm:min-h-17 sm:grid-cols-[minmax(0,1.3fr)_100px_120px_96px] sm:gap-4 sm:py-0 ${
                isDarkTheme ? "hover:bg-white/5" : ""
              }`}
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm font-black">{group.name}</strong>
                <span className="text-xs font-bold text-slate-500">
                  {group.isOwner ? "You're the organizer" : "You're a member"}
                </span>
                <span className="mt-1 block text-xs font-bold text-slate-500 sm:hidden">
                  {plural(group.members.length, "member")} - {formatDashboardDate(group.event_date)}
                </span>
              </span>
              <span className="hidden text-sm font-bold sm:block">
                {plural(group.members.length, "member")}
              </span>
              <span className="hidden text-sm font-bold sm:block">
                {formatDashboardDate(group.event_date)}
              </span>
              <span className="flex items-center justify-self-end gap-2 sm:justify-self-start">
                <StatusChip tone={group.hasDrawn ? "green" : "gold"}>
                  {group.hasDrawn ? "Drawn" : "Setup"}
                </StatusChip>
                <ArrowRightIcon className="h-3.5 w-3.5 text-[#48664e] transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={onOpenGroups}
            className="min-h-20 w-full px-5 text-left text-sm font-extrabold text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#48664e]"
          >
            No active exchanges yet. Create or accept one to begin.
          </button>
        )}
      </div>
    </section>
  );
}

export function AttentionRail({
  activityFeedItems,
  attentionItems,
  budgetLabel,
  focusGroup,
  giftDayLabel,
  isDarkTheme,
  onOpenPath,
}: {
  activityFeedItems: DashboardActivityItem[];
  attentionItems: DashboardAttentionItem[];
  budgetLabel: string;
  focusGroup: Group | null;
  giftDayLabel: string;
  isDarkTheme: boolean;
  onOpenPath: (path: string) => void;
}) {
  const latestUpdate = activityFeedItems[0]?.title || null;
  const railClass = isDarkTheme
    ? "border-slate-700/60 bg-slate-900/58 text-slate-100"
    : "border-[rgba(72,102,78,.14)] bg-white/78 text-[#2e3432]";

  return (
    <aside
      data-testid="dashboard-attention-rail"
      className={`min-w-0 overflow-hidden rounded-3xl border xl:sticky xl:top-24 ${railClass}`}
    >
      <div className="px-5 py-5 sm:px-6">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7b5902]">
          {focusGroup ? "Current priorities" : "Getting started"}
        </p>
        <h2 className="mt-1 font-[var(--app-display-font)] text-[25px] font-black leading-tight">
          {focusGroup ? "Needs attention" : "Start here"}
        </h2>
        <p className={`mt-1 text-sm font-bold leading-5 ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
          {focusGroup
            ? "Only items that can use a next step appear here."
            : "Create or join an exchange to unlock your dashboard."}
        </p>
      </div>

      <div className="border-t border-[rgba(72,102,78,.14)] px-5 sm:px-6">
        {attentionItems.length > 0 ? (
          attentionItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onAction}
              className="group grid min-h-20 w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[rgba(72,102,78,.12)] py-3.5 text-left last:border-b-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#48664e]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#48664e]/10 text-[#48664e]">
                {item.icon}
              </span>
              <span className="min-w-0">
                <strong className="block text-sm font-black leading-5">{item.label}</strong>
                <span className={`mt-0.5 block text-xs font-bold leading-4 ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  {item.detail}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className={getStatusChipClass(item.tone)}>{item.actionLabel}</span>
                <ArrowRightIcon className="h-3.5 w-3.5 text-[#48664e] transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))
        ) : (
          <div className="py-5">
            <strong className="block text-sm font-black">
              {focusGroup ? "You are all caught up." : "No exchange selected yet."}
            </strong>
            <span className={`mt-1 block text-xs font-bold leading-5 ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
              {focusGroup
                ? "New invite, wishlist, message, or gift tasks will appear here."
                : "Your next steps will appear after you create or join a group."}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-[rgba(72,102,78,.14)] px-5 py-5 sm:px-6">
        <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#48664e]">
          Coming up
        </h3>
        <dl className="mt-3 space-y-2.5 text-sm font-bold">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Gift day</dt>
            <dd className="text-right">{giftDayLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Budget</dt>
            <dd className="text-right">{budgetLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Name draw</dt>
            <dd className="text-right">{focusGroup?.hasDrawn ? "Complete" : "Not drawn"}</dd>
          </div>
        </dl>
      </div>

      {latestUpdate ? (
        <button
          type="button"
          onClick={() => onOpenPath("/notifications")}
          className="group w-full border-t border-[rgba(72,102,78,.14)] px-5 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#48664e] sm:px-6"
        >
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#48664e]">
            Latest update
          </span>
          <span className="mt-2 flex items-start justify-between gap-3">
            <strong className="text-sm font-black leading-5">{latestUpdate}</strong>
            <ArrowRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#48664e] transition group-hover:translate-x-0.5" />
          </span>
        </button>
      ) : null}
    </aside>
  );
}
