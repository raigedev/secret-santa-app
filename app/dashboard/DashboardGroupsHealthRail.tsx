import type { ReactNode } from "react";
import Link from "next/link";
import { formatDashboardDate, formatDashboardEventCountdown } from "./dashboard-formatters";
import { ArrowRightIcon, GiftIcon, UserOutlineIcon, WishlistIcon } from "./dashboard-icons";
import type { Group } from "./dashboard-types";
import { CalendarIcon } from "./DashboardGroupsWorkspaceParts";

type GroupHealthRailProps = {
  countdownNow: number;
  group: Group;
  isDarkTheme: boolean;
};

type StatusTone = "attention" | "neutral" | "positive";

export function GroupHealthRail({ countdownNow, group, isDarkTheme }: GroupHealthRailProps) {
  const countdownLabel = formatDashboardEventCountdown(group.event_date, countdownNow);
  const giftDayNeedsReview = countdownLabel === "Gift day passed";
  const summary = giftDayNeedsReview
    ? { label: "Check date", tone: "attention" as const }
    : group.hasDrawn
      ? { label: "Names drawn", tone: "positive" as const }
      : group.isOwner
        ? { label: "Draw pending", tone: "attention" as const }
        : { label: "Owner setup", tone: "neutral" as const };

  return (
    <aside
      data-testid="group-status-rail"
      className={`rounded-3xl p-4 xl:sticky xl:top-24 ${
        isDarkTheme ? "holiday-panel-dark text-slate-100" : "holiday-panel text-[#2e3432]"
      }`}
      aria-label="Exchange status"
    >
      <div className="flex items-start gap-3 pb-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isDarkTheme ? "bg-slate-800 text-emerald-300" : "bg-[#eaf6ec] text-[#48664e]"
          }`}
        >
          <StatusIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`text-base font-black ${isDarkTheme ? "text-white" : "text-[#48664e]"}`}>
            Exchange status
          </h3>
          <p className={isDarkTheme ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
            Quick checks for this group.
          </p>
        </div>
        <StatusLabel isDarkTheme={isDarkTheme} tone={summary.tone}>
          {summary.label}
        </StatusLabel>
      </div>

      <div
        className={`divide-y border-y ${
          isDarkTheme ? "divide-slate-700 border-slate-700" : "divide-[#dfe6df] border-[#dfe6df]"
        }`}
      >
        <StatusRow
          body={group.isOwner ? "Manage access and invitations." : "View group members."}
          href={group.isOwner ? `/group/${group.id}#member-management` : `/group/${group.id}`}
          icon={<UserOutlineIcon className="h-5 w-5" />}
          isDarkTheme={isDarkTheme}
          status={`${group.members.length} joined`}
          title="Members"
          tone="neutral"
        />
        <StatusRow
          body="Review member wishlists."
          href={`/group/${group.id}#group-members`}
          icon={<WishlistIcon className="h-5 w-5" />}
          isDarkTheme={isDarkTheme}
          status="Review"
          title="Wishlists"
          tone="neutral"
        />
        <StatusRow
          body={
            group.hasDrawn
              ? "Names are assigned."
              : group.isOwner
                ? "Draw names when everyone is ready."
                : "The owner will draw names."
          }
          href={group.isOwner ? `/group/${group.id}#draw-controls` : `/group/${group.id}`}
          icon={<GiftIcon className="h-5 w-5" />}
          isDarkTheme={isDarkTheme}
          status={group.hasDrawn ? "Complete" : group.isOwner ? "Action needed" : "Waiting"}
          title="Name draw"
          tone={group.hasDrawn ? "positive" : group.isOwner ? "attention" : "neutral"}
        />
        <StatusRow
          body={countdownLabel}
          href={`/group/${group.id}`}
          icon={<CalendarIcon />}
          isDarkTheme={isDarkTheme}
          status={formatDashboardDate(group.event_date)}
          title="Gift day"
          tone={giftDayNeedsReview ? "attention" : "neutral"}
        />
      </div>
    </aside>
  );
}

function StatusRow({
  body,
  href,
  icon,
  isDarkTheme,
  status,
  title,
  tone,
}: {
  body: string;
  href: string;
  icon: ReactNode;
  isDarkTheme: boolean;
  status: string;
  title: string;
  tone: StatusTone;
}) {
  return (
    <Link
      data-testid="group-status-row"
      href={href}
      className={`group grid min-h-16 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#54745c] focus-visible:ring-offset-2 ${
        isDarkTheme ? "hover:bg-white/5 focus-visible:ring-offset-slate-900" : "hover:bg-[#f6f8f5]"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isDarkTheme ? "bg-slate-800 text-emerald-300" : "bg-[#f0f4f0] text-[#48664e]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={isDarkTheme ? "block text-sm font-black text-white" : "block text-sm font-black text-[#2e3432]"}>
          {title}
        </span>
        <span
          className={
            isDarkTheme
              ? "mt-0.5 block text-xs leading-4 text-slate-300"
              : "mt-0.5 block text-xs leading-4 text-slate-500"
          }
        >
          {body}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StatusLabel isDarkTheme={isDarkTheme} tone={tone}>
          {status}
        </StatusLabel>
        <ArrowRightIcon
          className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
            isDarkTheme ? "text-emerald-300" : "text-[#48664e]"
          }`}
        />
      </span>
    </Link>
  );
}

function StatusLabel({
  children,
  isDarkTheme,
  tone,
}: {
  children: ReactNode;
  isDarkTheme: boolean;
  tone: StatusTone;
}) {
  const toneClass =
    tone === "positive"
      ? isDarkTheme
        ? "text-emerald-300"
        : "text-[#3f724c]"
      : tone === "attention"
        ? isDarkTheme
          ? "text-amber-300"
          : "text-[#9a4b12]"
        : isDarkTheme
          ? "text-slate-300"
          : "text-slate-600";

  return <span className={`shrink-0 text-right text-xs font-black ${toneClass}`}>{children}</span>;
}

function StatusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M3 10h3l1.5-4 3 8 1.5-4h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
