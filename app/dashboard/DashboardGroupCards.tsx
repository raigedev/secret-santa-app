import {
  formatDashboardBudget,
  formatDashboardDate,
  formatDashboardEventCountdown,
  getAvatarLabel,
  getDashboardMemberLabel,
} from "./dashboard-formatters";
import { GiftIcon, UserOutlineIcon } from "./dashboard-icons";
import type { Group } from "./dashboard-types";
import { getGroupHistoryState } from "@/lib/groups/history";

type DashboardGroupType = "owned" | "invited";

type DashboardGroupBucketProps = {
  title: string;
  count: number;
  groups: Group[];
  type: DashboardGroupType;
  countdownNow: number;
  deletingGroupId: string | null;
  isDarkTheme: boolean;
  onOpenGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
};

type DashboardGroupCardProps = {
  group: Group;
  type: DashboardGroupType;
  countdownNow: number;
  deletingGroupId: string | null;
  isDarkTheme: boolean;
  onOpenGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
};

function DashboardGroupCard({
  group,
  type,
  countdownNow,
  deletingGroupId,
  isDarkTheme,
  onOpenGroup,
  onDeleteGroup,
}: DashboardGroupCardProps) {
  const budgetLabel = formatDashboardBudget(group.budget, group.currency);
  const memberCountLabel = `${group.members.length} member${group.members.length === 1 ? "" : "s"}`;
  const eventCountdownLabel = formatDashboardEventCountdown(group.event_date, countdownNow);
  const historyState = getGroupHistoryState(group.event_date, new Date(countdownNow));
  const showHistoryNotice = historyState.isGracePeriod && historyState.daysUntilHistory !== null;
  const isOwnedGroup = type === "owned";
  const avatarShell = isDarkTheme
    ? "bg-slate-800 text-slate-100 ring-slate-900"
    : "bg-slate-100 text-slate-600 ring-white";
  const groupIconClass = isOwnedGroup
    ? isDarkTheme
      ? "bg-rose-500/15 text-rose-200"
      : "bg-red-100 text-red-600"
    : isDarkTheme
      ? "bg-sky-500/15 text-sky-200"
      : "bg-blue-100 text-blue-600";
  const datePillClass = isOwnedGroup
    ? isDarkTheme
      ? "bg-rose-500/15 text-rose-100"
      : "bg-red-50 text-red-700"
    : isDarkTheme
      ? "bg-sky-500/15 text-sky-100"
      : "bg-blue-50 text-blue-700";
  const topMembers = group.members.slice(0, 3);

  return (
    <article
      className={`group rounded-3xl p-5 shadow-[0_8px_22px_rgba(45,51,55,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(45,51,55,0.07)] ${
        isDarkTheme ? "bg-slate-900/82 text-slate-100" : "bg-white text-slate-900"
      }`}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
        <button
          type="button"
          onClick={() => onOpenGroup(group.id)}
          className="flex min-w-0 items-center gap-4 text-left"
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${groupIconClass}`}>
            {isOwnedGroup ? <GiftIcon className="h-5 w-5" /> : <UserOutlineIcon className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[18px] font-extrabold leading-tight">
              {group.name}
            </span>
            <span className={`mt-1 block text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
              {budgetLabel ? `Budget: ${budgetLabel}` : "No budget set"} • {memberCountLabel}
            </span>
          </span>
        </button>

        <div className="flex -space-x-3 md:justify-center">
          {topMembers.map((member, index) => (
            <span
              key={`${group.id}-${member.email || member.nickname || index}-avatar`}
              className={`inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-[17px] font-bold ring-4 ${avatarShell}`}
              title={getDashboardMemberLabel(member, group.require_anonymous_nickname)}
            >
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                member.avatarEmoji ||
                getAvatarLabel(getDashboardMemberLabel(member, group.require_anonymous_nickname))
              )}
            </span>
          ))}
          {group.members.length > 3 && (
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ring-4 ${avatarShell}`}>
              +{group.members.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <button
            type="button"
            onClick={() => onOpenGroup(group.id)}
            className={`rounded-full px-4 py-2 text-sm font-extrabold ${datePillClass}`}
            title={`Event date: ${formatDashboardDate(group.event_date)}`}
          >
            {eventCountdownLabel}
          </button>
          {type === "owned" && (
            <button
              type="button"
              onClick={() => void onDeleteGroup(group.id, group.name)}
              disabled={deletingGroupId === group.id}
              className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                isDarkTheme
                  ? "bg-slate-800 text-slate-300 hover:bg-rose-500/15 hover:text-rose-200"
                  : "bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              }`}
            >
              {deletingGroupId === group.id ? "Deleting" : "Delete"}
            </button>
          )}
        </div>
      </div>
      {showHistoryNotice && (
        <div
          className={`mt-4 rounded-[18px] px-4 py-3 text-sm font-semibold leading-6 ${
            isDarkTheme
              ? "bg-amber-500/10 text-amber-100"
              : "bg-amber-50 text-amber-900"
          }`}
        >
          Moves to History in {historyState.daysUntilHistory} day
          {historyState.daysUntilHistory === 1 ? "" : "s"}.{" "}
          {isOwnedGroup
            ? "Update the event date if this exchange is still active."
            : "The owner can update the event date if this exchange is still active."}
        </div>
      )}
    </article>
  );
}

export function DashboardGroupBucket({
  title,
  count,
  groups,
  type,
  countdownNow,
  deletingGroupId,
  isDarkTheme,
  onOpenGroup,
  onDeleteGroup,
}: DashboardGroupBucketProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-2">
        <h3 className={`text-xs font-black uppercase tracking-[0.22em] ${isDarkTheme ? "text-slate-500" : "text-slate-400"}`}>
          {title}
        </h3>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${isDarkTheme ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-500"}`}>
          {count} group{count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-4">
        {groups.map((group) => (
          <DashboardGroupCard
            key={`${type}-${group.id}`}
            group={group}
            type={type}
            countdownNow={countdownNow}
            deletingGroupId={deletingGroupId}
            isDarkTheme={isDarkTheme}
            onOpenGroup={onOpenGroup}
            onDeleteGroup={onDeleteGroup}
          />
        ))}
      </div>
    </section>
  );
}
