import { DashboardGroupBucket } from "./DashboardGroupCards";
import { ArrowRightIcon } from "./dashboard-icons";
import type { Group } from "./dashboard-types";

type DashboardGroupsSectionProps = {
  countdownNow: number;
  deletingGroupId: string | null;
  invitedGroups: Group[];
  isDarkTheme: boolean;
  ownedGroups: Group[];
  totalDashboardGroupCount: number;
  onCreateGroup: () => void;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
  onOpenGroup: (groupId: string) => void;
};

export function DashboardGroupsSection({
  countdownNow,
  deletingGroupId,
  invitedGroups,
  isDarkTheme,
  ownedGroups,
  totalDashboardGroupCount,
  onCreateGroup,
  onDeleteGroup,
  onOpenGroup,
}: DashboardGroupsSectionProps) {
  const dashboardPanelHeadingClass = isDarkTheme ? "text-white" : "text-slate-900";
  const dashboardPanelTextClass = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const dashboardStatLabelClass = isDarkTheme ? "text-slate-500" : "text-slate-400";

  return (
    <section id="dashboard-groups" className="scroll-mt-24">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className={`text-[1.85rem] font-black tracking-tight ${dashboardPanelHeadingClass}`}>
            Your Groups
          </h2>
          <p className={`mt-1 text-[15px] ${dashboardPanelTextClass}`}>
            Groups you host and groups you joined, all in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateGroup}
          className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold transition hover:-translate-y-0.5 sm:inline-flex ${
            isDarkTheme ? "bg-red-500/12 text-red-200" : "bg-red-50 text-red-700"
          }`}
        >
          New group
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {totalDashboardGroupCount === 0 ? (
        <section
          className={`relative overflow-hidden rounded-[28px] p-7 shadow-[0_12px_30px_rgba(45,51,55,0.04)] ${
            isDarkTheme ? "bg-slate-900/82 text-slate-100" : "bg-white text-slate-900"
          }`}
        >
          <div className="absolute bottom-4 right-6 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,#dbeafe,transparent_70%)] opacity-80" />
          <p className={`text-[12px] font-black uppercase tracking-[0.18em] ${dashboardStatLabelClass}`}>
            Start here
          </p>
          <h3 className="mt-4 text-2xl font-black">Don&apos;t have a group yet?</h3>
          <p className={`mt-3 max-w-md text-[15px] leading-7 ${dashboardPanelTextClass}`}>
            Create a group and start your Secret Santa planning with a budget, date, and invite list already in place.
          </p>
          <button
            type="button"
            onClick={onCreateGroup}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#186be8] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_14px_30px_rgba(24,107,232,0.22)] transition hover:-translate-y-0.5"
          >
            Start new group
            <ArrowRightIcon />
          </button>
        </section>
      ) : (
        <div className="space-y-8">
          {ownedGroups.length > 0 && (
            <DashboardGroupBucket
              title="Hosted by you"
              count={ownedGroups.length}
              groups={ownedGroups}
              type="owned"
              countdownNow={countdownNow}
              deletingGroupId={deletingGroupId}
              isDarkTheme={isDarkTheme}
              onOpenGroup={onOpenGroup}
              onDeleteGroup={onDeleteGroup}
            />
          )}
          {invitedGroups.length > 0 && (
            <DashboardGroupBucket
              title="Joined as member"
              count={invitedGroups.length}
              groups={invitedGroups}
              type="invited"
              countdownNow={countdownNow}
              deletingGroupId={deletingGroupId}
              isDarkTheme={isDarkTheme}
              onOpenGroup={onOpenGroup}
              onDeleteGroup={onDeleteGroup}
            />
          )}
        </div>
      )}
    </section>
  );
}
