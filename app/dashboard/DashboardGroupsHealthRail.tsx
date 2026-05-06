import type { ReactNode } from "react";
import Link from "next/link";
import { formatDashboardDate, formatDashboardEventCountdown } from "./dashboard-formatters";
import { ArrowRightIcon, UserOutlineIcon, WishlistIcon } from "./dashboard-icons";
import type { Group } from "./dashboard-types";
import { CalendarIcon } from "./DashboardGroupsWorkspaceParts";

type GroupHealthRailProps = {
  countdownNow: number;
  group: Group;
  isDarkTheme: boolean;
  onOpenGroup: (groupId: string) => void;
};

export function GroupHealthRail({
  countdownNow,
  group,
  isDarkTheme,
  onOpenGroup,
}: GroupHealthRailProps) {
  const countdownLabel = formatDashboardEventCountdown(group.event_date, countdownNow);

  return (
    <aside
      className={`rounded-3xl p-5 shadow-[0_18px_44px_rgba(46,52,50,0.06)] ring-1 ring-[rgba(72,102,78,0.12)] xl:sticky xl:top-24 ${
        isDarkTheme ? "bg-slate-900/85 text-slate-100" : "bg-white/95 text-[#2e3432]"
      }`}
      aria-label="Exchange health"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf6ec] text-[#48664e]">
          <HealthIcon />
        </span>
        <div>
          <h3 className="text-lg font-black text-[#48664e]">Exchange health</h3>
          <p className="text-sm text-slate-500">Keep your exchange on track.</p>
        </div>
      </div>

      <div className="space-y-3">
        <HealthRow
          body={group.isOwner ? "Open the group to check member access." : "The owner manages invitations."}
          href={group.isOwner ? `/group/${group.id}#member-management` : `/group/${group.id}`}
          icon={<MailIcon />}
          isDarkTheme={isDarkTheme}
          status={group.isOwner ? "Review" : "Owner managed"}
          title="Invites"
        />
        <HealthRow
          body="Open the group to review wishlist readiness."
          href={`/group/${group.id}#group-members`}
          icon={<WishlistIcon className="h-5 w-5" />}
          isDarkTheme={isDarkTheme}
          status="Check"
          title="Wishlists"
        />
        <HealthRow
          body={
            group.hasDrawn
              ? "Names have been drawn."
              : group.isOwner
                ? "Draw names when the group is ready."
                : "The owner will draw names when ready."
          }
          href={group.isOwner ? `/group/${group.id}#draw-controls` : `/group/${group.id}`}
          icon={<UserOutlineIcon className="h-5 w-5" />}
          isDarkTheme={isDarkTheme}
          status={group.hasDrawn ? "Done" : "Ready soon"}
          title="Draw status"
        />
        <HealthRow
          body={countdownLabel}
          href={`/group/${group.id}`}
          icon={<CalendarIcon />}
          isDarkTheme={isDarkTheme}
          status={formatDashboardDate(group.event_date)}
          title="Gift day"
        />
      </div>

      <button
        type="button"
        onClick={() => onOpenGroup(group.id)}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#48664e] px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(72,102,78,0.18)] transition hover:-translate-y-0.5"
      >
        Open full workspace
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </aside>
  );
}

function HealthRow({
  body,
  href,
  icon,
  isDarkTheme,
  status,
  title,
}: {
  body: string;
  href: string;
  icon: ReactNode;
  isDarkTheme: boolean;
  status: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(72,102,78,0.1)] transition hover:-translate-y-0.5 ${
        isDarkTheme ? "bg-slate-800 text-slate-100" : "bg-white"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f2f4f2] text-[#48664e]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className={isDarkTheme ? "font-black text-white" : "font-black text-[#2e3432]"}>
            {title}
          </span>
          <span className="shrink-0 text-xs font-black text-[#a43c3f]">{status}</span>
        </span>
        <span
          className={
            isDarkTheme
              ? "mt-0.5 block text-sm leading-5 text-slate-300"
              : "mt-0.5 block text-sm leading-5 text-slate-500"
          }
        >
          {body}
        </span>
      </span>
      <ArrowRightIcon className="h-4 w-4 shrink-0 text-[#48664e]" />
    </Link>
  );
}

function HealthIcon() {
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

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3.5" y="5" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m4.5 6.5 5.5 4 5.5-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
