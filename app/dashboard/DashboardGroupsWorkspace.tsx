import {
  formatDashboardBudget,
  formatDashboardDate,
} from "./dashboard-formatters";
import { ArrowRightIcon, UserOutlineIcon } from "./dashboard-icons";
import type { Group } from "./dashboard-types";
import {
  BudgetIcon,
  CalendarIcon,
  GroupGiftBadge,
  MetaItem,
} from "./DashboardGroupsWorkspaceParts";
import { GroupHealthRail } from "./DashboardGroupsHealthRail";
import { getGroupHistoryState } from "@/lib/groups/history";

type DashboardGroupsWorkspaceProps = {
  countdownNow: number;
  deletingGroupId: string | null;
  focusedGroup: Group | null;
  groups: Group[];
  isDarkTheme: boolean;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
  onOpenGroup: (groupId: string) => void;
  onSelectGroup: (groupId: string) => void;
};

export function DashboardGroupsWorkspace({
  countdownNow,
  deletingGroupId,
  focusedGroup,
  groups,
  isDarkTheme,
  onDeleteGroup,
  onOpenGroup,
  onSelectGroup,
}: DashboardGroupsWorkspaceProps) {
  if (!focusedGroup) {
    return null;
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="min-w-0 space-y-5">
        {groups.length > 1 && (
          <GroupSwitcher
            focusedGroupId={focusedGroup.id}
            groups={groups}
            isDarkTheme={isDarkTheme}
            onSelectGroup={onSelectGroup}
          />
        )}

        <GroupWorkspacePreview
          countdownNow={countdownNow}
          deletingGroupId={deletingGroupId}
          group={focusedGroup}
          isDarkTheme={isDarkTheme}
          onDeleteGroup={onDeleteGroup}
          onOpenGroup={onOpenGroup}
        />
      </div>

      <GroupHealthRail
        countdownNow={countdownNow}
        group={focusedGroup}
        isDarkTheme={isDarkTheme}
        onOpenGroup={onOpenGroup}
      />
    </div>
  );
}

function GroupSwitcher({
  focusedGroupId,
  groups,
  isDarkTheme,
  onSelectGroup,
}: {
  focusedGroupId: string;
  groups: Group[];
  isDarkTheme: boolean;
  onSelectGroup: (groupId: string) => void;
}) {
  return (
    <div
      className={`rounded-3xl p-2 ${
        isDarkTheme ? "holiday-panel-dark" : "holiday-panel-soft"
      }`}
      aria-label="Choose group"
    >
      <div className="flex gap-2 overflow-x-auto p-1">
        {groups.map((group) => {
          const selected = group.id === focusedGroupId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-black transition hover:-translate-y-0.5 ${
                selected
                  ? "bg-[#48664e] text-white shadow-[0_12px_22px_rgba(72,102,78,0.18)]"
                  : isDarkTheme
                    ? "bg-slate-800 text-slate-200"
                    : "bg-slate-50 text-slate-700"
              }`}
              aria-pressed={selected}
            >
              <span className="max-w-44 truncate">{group.name}</span>
              <span className={selected ? "text-white/80" : "text-slate-400"}>
                {group.members.length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupWorkspacePreview({
  countdownNow,
  deletingGroupId,
  group,
  isDarkTheme,
  onDeleteGroup,
  onOpenGroup,
}: {
  countdownNow: number;
  deletingGroupId: string | null;
  group: Group;
  isDarkTheme: boolean;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
  onOpenGroup: (groupId: string) => void;
}) {
  const budgetLabel = formatDashboardBudget(group.budget, group.currency) || "No budget set";
  const dateLabel = formatDashboardDate(group.event_date);
  const historyState = getGroupHistoryState(group.event_date, new Date(countdownNow));
  const showHistoryNotice = historyState.isGracePeriod && historyState.daysUntilHistory !== null;
  const roleLabel = group.isOwner ? "Owner" : "Member";

  return (
    <section className="min-w-0 space-y-5" aria-label={`${group.name} workspace preview`}>
      <div
        className={`rounded-3xl p-5 sm:p-6 ${
          isDarkTheme ? "holiday-panel-dark text-slate-100" : "holiday-panel-strong text-[#2e3432]"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <GroupGiftBadge imageUrl={group.image_url} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h3
                  className={`truncate text-3xl font-black leading-tight ${
                    isDarkTheme ? "text-white" : "text-[#48664e]"
                  }`}
                  style={{ fontFamily: "'Fredoka', sans-serif" }}
                >
                  {group.name}
                </h3>
                <span className="rounded-full bg-[#fff4df] px-3 py-1 text-xs font-black text-[#7b5902] shadow-[inset_0_0_0_1px_rgba(123,89,2,0.1)]">
                  {roleLabel}
                </span>
              </div>
              <div
                className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold ${
                  isDarkTheme ? "text-slate-300" : "text-[#5b605e]"
                }`}
              >
                <MetaItem icon={<UserOutlineIcon className="h-4 w-4" />} label={`${group.members.length} members`} />
                <MetaItem icon={<CalendarIcon />} label={`Gift day: ${dateLabel}`} />
                <MetaItem icon={<BudgetIcon />} label={`Budget: ${budgetLabel}`} />
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenGroup(group.id)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#48664e] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(72,102,78,0.18)] transition hover:-translate-y-0.5 sm:w-auto sm:min-w-52"
            >
              Open overview
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            {group.isOwner && (
              <button
                type="button"
                onClick={() => void onDeleteGroup(group.id, group.name)}
                disabled={deletingGroupId === group.id}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-[#f5caca] bg-[#fff8f8] px-4 text-sm font-black text-[#a43c3f] transition hover:-translate-y-0.5 hover:border-[#e6a9aa] hover:bg-[#fff1f2] hover:text-[#812227] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {deletingGroupId === group.id ? "Deleting" : "Delete group"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showHistoryNotice && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
          Moves to History in {historyState.daysUntilHistory} day
          {historyState.daysUntilHistory === 1 ? "" : "s"}.{" "}
          {group.isOwner
            ? "Update the event date if this exchange is still active."
            : "The owner can update the event date if this exchange is still active."}
        </div>
      )}
    </section>
  );
}
