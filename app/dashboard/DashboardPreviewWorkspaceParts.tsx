"use client";

import type { ReactNode } from "react";
import {
  formatDashboardDate,
  formatDashboardEventCountdown,
  formatRelativeTime,
} from "./dashboard-formatters";
import { ArrowRightIcon, ChatIcon, GiftIcon, PlusIcon, WishlistIcon } from "./dashboard-icons";
import type { DashboardActivityItem, GiftProgressStep, Group } from "./dashboard-types";

export type HealthRow = {
  label: string;
  percent: number;
  value: string;
  tone?: "gold" | "quiet";
};

const giftProgressSteps: { id: GiftProgressStep; label: string; shortLabel: string }[] = [
  { id: "planning", label: "Idea saved", shortLabel: "Idea" },
  { id: "purchased", label: "Purchased", shortLabel: "Bought" },
  { id: "wrapped", label: "Wrapped", shortLabel: "Wrapped" },
  { id: "ready_to_give", label: "Ready to give", shortLabel: "Ready" },
];

export function getPanelClass(isDarkTheme: boolean): string {
  return isDarkTheme
    ? "border border-slate-700/65 bg-slate-900/72 text-slate-100 shadow-[0_14px_36px_rgba(0,0,0,.14)] backdrop-blur-sm"
    : "border border-white/65 bg-[#fbfcfa]/60 text-[#2e3432] shadow-[inset_0_1px_0_rgba(255,255,255,.72)] ring-1 ring-[rgba(72,102,78,.06)] backdrop-blur-sm";
}

export function getSoftPanelClass(isDarkTheme: boolean): string {
  return isDarkTheme
    ? "border border-slate-700/60 bg-slate-800/48"
    : "border border-white/60 bg-[#f8fbf7]/40 shadow-[inset_0_1px_0_rgba(255,255,255,.58)] ring-1 ring-[rgba(72,102,78,.045)]";
}

export function SectionHeader({
  action,
  children,
  isDarkTheme,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  isDarkTheme: boolean;
  title: string;
}) {
  return (
    <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className={`text-[22px] font-black tracking-tight ${isDarkTheme ? "text-white" : "text-slate-950"}`}>
          {title}
        </h2>
        {children ? (
          <p className={`mt-1 text-[13px] font-bold leading-5 ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
            {children}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function WishlistProgressCard({
  isDarkTheme,
  onOpenWishlist,
  wishlistItemCount,
  wishlistPercent,
}: {
  isDarkTheme: boolean;
  onOpenWishlist: () => void;
  wishlistItemCount: number;
  wishlistPercent: number;
}) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[30px] p-5 ${getPanelClass(isDarkTheme)}`}>
      <SectionHeader action={<button type="button" onClick={onOpenWishlist} className="text-[12px] font-black text-[#a43c3f]">Edit</button>} isDarkTheme={isDarkTheme} title="Wishlist progress" />
      <div className="grid min-w-0 grid-cols-[82px_minmax(0,1fr)] items-center gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-full" style={{ background: `conic-gradient(#48664e 0 ${wishlistPercent}%, #e5e9e5 ${wishlistPercent}% 100%)` }}>
          <div className="grid h-15 w-15 place-items-center rounded-full bg-white text-center text-[26px] font-black text-[#48664e]">{wishlistItemCount}</div>
        </div>
        <div className="min-w-0">
          <strong className="text-[16px] font-black">Keep adding clues</strong>
          <p className={`mt-1 break-words text-[13px] font-bold [overflow-wrap:anywhere] ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>Aim for at least 5 ideas so your Santa has options.</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e9e5]">
            <span className="block h-full rounded-full bg-[#48664e]" style={{ width: `${wishlistPercent}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function GiftProgressCard({
  activeStepIndex,
  isDarkTheme,
  onOpenGiftProgress,
}: {
  activeStepIndex: number;
  isDarkTheme: boolean;
  onOpenGiftProgress: () => void;
}) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[30px] p-5 ${getPanelClass(isDarkTheme)}`}>
      <SectionHeader action={<button type="button" onClick={onOpenGiftProgress} className="text-[12px] font-black text-[#a43c3f]">Open progress</button>} isDarkTheme={isDarkTheme} title="Gift progress" />
      <div className="grid grid-cols-4 gap-2">
        {giftProgressSteps.map((step, index) => {
          const done = index <= activeStepIndex;
          return (
            <div
              key={step.id}
              aria-label={`${step.label}: ${done ? "complete" : "not complete"}`}
              className={`flex min-h-23 min-w-0 flex-col items-center justify-center rounded-[18px] px-1.5 py-3 text-center ${getSoftPanelClass(isDarkTheme)}`}
              title={step.label}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${done ? "bg-[#48664e] text-white" : "bg-slate-200 text-slate-400"}`}>
                {done ? "OK" : index + 1}
              </span>
              <strong className="mt-2 block max-w-full truncate whitespace-nowrap text-[11px] font-black leading-none sm:text-[12px]">
                {step.shortLabel}
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function UpcomingDatesCard({
  countdownNow,
  focusGroup,
  isDarkTheme,
  onOpenGroups,
}: {
  countdownNow: number;
  focusGroup: Group | null;
  isDarkTheme: boolean;
  onOpenGroups: () => void;
}) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[30px] p-5 ${getPanelClass(isDarkTheme)}`}>
      <SectionHeader action={<button type="button" onClick={onOpenGroups} className="text-[12px] font-black text-[#a43c3f]">All dates</button>} isDarkTheme={isDarkTheme} title="Upcoming dates" />
      <div className="space-y-3">
        <DateRow label="Next gift day" value={focusGroup ? formatDashboardDate(focusGroup.event_date) : "No date yet"} detail={focusGroup?.name || "Create an exchange to start planning."} />
        <DateRow label="Exchange status" value={focusGroup ? formatDashboardEventCountdown(focusGroup.event_date, countdownNow) : "Open"} detail={focusGroup ? (focusGroup.isOwner ? "Hosting" : "Participant") : "Ready when you are."} />
      </div>
    </section>
  );
}

function DateRow({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-200/60 pb-3 last:border-b-0 last:pb-0">
      <span className="min-w-0">
        <strong className="block text-[14px]">{label}</strong>
        <span className="mt-1 block break-words text-[12px] font-bold text-slate-500 [overflow-wrap:anywhere]">{detail}</span>
      </span>
      <b className="max-w-36 break-words text-right text-[13px] text-[#48664e] [overflow-wrap:anywhere]">{value}</b>
    </div>
  );
}

export function QuickActionsCard({
  hasAssignments,
  isDarkTheme,
  onCreateGroup,
  onOpenChat,
  onOpenSecretSanta,
  onOpenWishlist,
}: {
  hasAssignments: boolean;
  isDarkTheme: boolean;
  onCreateGroup: () => void;
  onOpenChat: () => void;
  onOpenSecretSanta: () => void;
  onOpenWishlist: () => void;
}) {
  const actions = [
    { icon: <PlusIcon />, label: "Create exchange", onClick: onCreateGroup },
    { icon: <GiftIcon />, label: hasAssignments ? "View my giftee" : "My giftee", onClick: onOpenSecretSanta },
    { icon: <WishlistIcon />, label: "Edit wishlist", onClick: onOpenWishlist },
    { icon: <ChatIcon />, label: "Messages", onClick: onOpenChat },
  ];

  return (
    <section className={`min-w-0 overflow-hidden rounded-[30px] p-5 ${getPanelClass(isDarkTheme)}`}>
      <SectionHeader isDarkTheme={isDarkTheme} title="Quick actions" />
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button key={action.label} type="button" onClick={action.onClick} className={`min-h-22 rounded-[18px] p-3 text-center text-[12px] font-black transition hover:-translate-y-0.5 ${getSoftPanelClass(isDarkTheme)}`}>
            <span className="mx-auto mb-2 flex h-7 w-7 items-center justify-center text-[#48664e]">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function HealthCard({ healthRows, isDarkTheme }: { healthRows: HealthRow[]; isDarkTheme: boolean }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[30px] p-5 ${getPanelClass(isDarkTheme)}`}>
      <SectionHeader isDarkTheme={isDarkTheme} title="Owner exchange health" />
      <div className="space-y-4">
        {healthRows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between gap-3 text-[13px] font-black">
              <span>{row.label}</span>
              <span className="text-[#48664e]">{row.value}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e5e9e5]">
              <span className={`block h-full rounded-full ${row.tone === "gold" ? "bg-[#f59e0b]" : row.tone === "quiet" ? "bg-slate-300" : "bg-[#48664e]"}`} style={{ width: `${row.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ShoppingIdeasCard({ isDarkTheme, onOpenPath }: { isDarkTheme: boolean; onOpenPath: (path: string) => void }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[30px] p-5 ${getPanelClass(isDarkTheme)}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7b5902]">Need gift ideas?</p>
      <p className={`mt-3 break-words text-[13px] font-bold leading-5 [overflow-wrap:anywhere] ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>Browse shopping ideas from wishlists and group budget.</p>
      <button type="button" onClick={() => onOpenPath("/secret-santa")} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#48664e] px-5 text-sm font-black text-white">
        Explore ideas
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </section>
  );
}

export function RecentChangesCard({ activityFeedItems, isDarkTheme, onOpenPath }: { activityFeedItems: DashboardActivityItem[]; isDarkTheme: boolean; onOpenPath: (path: string) => void }) {
  return (
    <section id="dashboard-activity" className={`min-w-0 overflow-hidden rounded-[30px] p-5 ${getPanelClass(isDarkTheme)}`}>
      <SectionHeader isDarkTheme={isDarkTheme} title="Recent changes">Quiet activity trail, below the work that matters now.</SectionHeader>
      {activityFeedItems.length === 0 ? (
        <p className={`rounded-3xl border border-dashed p-5 text-sm font-bold ${isDarkTheme ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>Once gift progress or group updates start happening, they will show up here.</p>
      ) : (
        <div className="divide-y divide-slate-200/70">
          {activityFeedItems.slice(0, 4).map((item) => (
            <button key={item.id} type="button" onClick={() => item.href && onOpenPath(item.href)} className="grid w-full grid-cols-[1fr_auto] gap-3 py-3 text-left">
              <span>
                <strong className="block text-[14px]">{item.title}</strong>
                <span className="mt-1 block text-[12px] font-bold text-slate-500">{item.subtitle}</span>
              </span>
              <span className="text-[12px] font-black text-slate-400">{formatRelativeTime(item.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
