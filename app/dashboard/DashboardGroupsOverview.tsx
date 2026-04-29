import {
  formatDashboardBudget,
  formatDashboardDate,
  formatDashboardEventCountdown,
  isDashboardEventReadyToReveal,
} from "./dashboard-formatters";
import { ArrowRightIcon, GiftIcon, UserOutlineIcon } from "./dashboard-icons";
import type { Group } from "./dashboard-types";

type DashboardGroupsOverviewProps = {
  countdownNow: number;
  invitedGroups: Group[];
  isDarkTheme: boolean;
  ownedGroups: Group[];
  onCreateGroup: () => void;
  onOpenGroup: (groupId: string) => void;
  onOpenGroups: () => void;
};

function getGroupEventTime(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getGroupRoleLabel(group: Group) {
  return group.isOwner ? "Hosting" : "Joined";
}

function getGroupMemberCountLabel(group: Group) {
  return `${group.members.length} member${group.members.length === 1 ? "" : "s"}`;
}

export function DashboardGroupsOverview({
  countdownNow,
  invitedGroups,
  isDarkTheme,
  ownedGroups,
  onCreateGroup,
  onOpenGroup,
  onOpenGroups,
}: DashboardGroupsOverviewProps) {
  const allGroups = [...ownedGroups, ...invitedGroups].sort(
    (left, right) => getGroupEventTime(left.event_date) - getGroupEventTime(right.event_date)
  );
  const nextGroups = allGroups.slice(0, 3);
  const hasGroups = allGroups.length > 0;
  const revealedGroups = allGroups.filter((group) =>
    isDashboardEventReadyToReveal(group.event_date, countdownNow)
  ).length;
  const panelClass = isDarkTheme
    ? "border border-slate-700/70 bg-slate-900/82 text-slate-100"
    : "border border-[rgba(72,102,78,.12)] bg-white text-slate-900";
  const mutedTextClass = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const quietTextClass = isDarkTheme ? "text-slate-500" : "text-slate-400";
  const statClass = isDarkTheme
    ? "border-slate-700/70 bg-slate-800/70"
    : "border-[rgba(148,163,184,.18)] bg-[#f8fbff]";
  const rowClass = isDarkTheme
    ? "border-slate-700/70 bg-slate-800/62 hover:bg-slate-800"
    : "border-[rgba(72,102,78,.12)] bg-[#fbfcfa] hover:bg-[#f7faf5]";

  return (
    <section id="dashboard-groups" className="scroll-mt-24">
      <div className={`overflow-hidden rounded-[30px] p-5 shadow-[0_14px_32px_rgba(45,51,55,0.05)] sm:p-6 ${panelClass}`}>
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
          <div>
            <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${quietTextClass}`}>
              Today at a glance
            </p>
            <h2 className="mt-2 text-[1.85rem] font-black leading-tight tracking-tight">
              Group snapshot
            </h2>
            <p className={`mt-2 max-w-xl text-[15px] leading-7 ${mutedTextClass}`}>
              Quick status for your exchanges. Open My Groups when you need the full list,
              invites, or owner actions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 2xl:justify-end">
            <button
              type="button"
              onClick={onOpenGroups}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#48664e] px-4 py-2 text-sm font-extrabold text-white shadow-[0_12px_26px_rgba(72,102,78,.18)] transition hover:-translate-y-0.5"
            >
              Open My Groups
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCreateGroup}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold transition hover:-translate-y-0.5 ${
                isDarkTheme ? "bg-slate-800 text-slate-100" : "bg-red-50 text-red-700"
              }`}
            >
              New group
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className={`rounded-[20px] border p-4 ${statClass}`}>
            <p className={`text-xs font-black uppercase tracking-[0.16em] ${quietTextClass}`}>Hosting</p>
            <p className="mt-2 text-3xl font-black">{ownedGroups.length}</p>
          </div>
          <div className={`rounded-[20px] border p-4 ${statClass}`}>
            <p className={`text-xs font-black uppercase tracking-[0.16em] ${quietTextClass}`}>Joined</p>
            <p className="mt-2 text-3xl font-black">{invitedGroups.length}</p>
          </div>
          <div className={`rounded-[20px] border p-4 ${statClass}`}>
            <p className={`text-xs font-black uppercase tracking-[0.16em] ${quietTextClass}`}>
              Names ready
            </p>
            <p className="mt-2 text-3xl font-black">{revealedGroups}</p>
          </div>
        </div>

        {hasGroups ? (
          <div className="mt-6 space-y-3">
            {nextGroups.map((group) => {
              const budgetLabel = formatDashboardBudget(group.budget, group.currency);

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onOpenGroup(group.id)}
                  className={`grid w-full gap-3 rounded-[20px] border p-4 text-left transition hover:-translate-y-0.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${rowClass}`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${
                      group.isOwner
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {group.isOwner ? <GiftIcon /> : <UserOutlineIcon className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] font-black">{group.name}</span>
                    <span className={`mt-1 block text-sm ${mutedTextClass}`}>
                      {getGroupRoleLabel(group)} / {getGroupMemberCountLabel(group)}
                      {budgetLabel ? ` / ${budgetLabel}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-black ${
                        group.isOwner ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                      }`}
                      title={`Event date: ${formatDashboardDate(group.event_date)}`}
                    >
                      {formatDashboardEventCountdown(group.event_date, countdownNow)}
                    </span>
                    <ArrowRightIcon className={`h-4 w-4 ${quietTextClass}`} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={`mt-6 rounded-[22px] border p-5 ${statClass}`}>
            <p className="text-lg font-black">Start your first exchange</p>
            <p className={`mt-2 max-w-lg text-sm leading-6 ${mutedTextClass}`}>
              Create a group, set the date and budget, then invite everyone from one place.
            </p>
            <button
              type="button"
              onClick={onCreateGroup}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#186be8] px-5 py-2 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(24,107,232,0.22)] transition hover:-translate-y-0.5"
            >
              Start new group
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
