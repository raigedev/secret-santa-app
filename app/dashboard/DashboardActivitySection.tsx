import { formatRelativeTime } from "./dashboard-formatters";
import { ArrowRightIcon } from "./dashboard-icons";
import type { DashboardActivityItem } from "./dashboard-types";
import { getDashboardToneTheme } from "./dashboard-visuals";

type DashboardActivitySectionProps = {
  activityFeedItems: DashboardActivityItem[];
  isDarkTheme: boolean;
  onOpenPath: (path: string) => void;
};

export function DashboardActivitySection({
  activityFeedItems,
  isDarkTheme,
  onOpenPath,
}: DashboardActivitySectionProps) {
  const dashboardPanelHeadingClass = isDarkTheme ? "text-white" : "text-slate-900";
  const dashboardPanelTextClass = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const utilityIconClass = isDarkTheme ? "text-slate-300" : "text-slate-500";

  return (
    <section id="dashboard-activity" className="scroll-mt-24">
      <h2 className={`mb-5 text-[1.85rem] font-black tracking-tight ${dashboardPanelHeadingClass}`}>
        Recent Activity
      </h2>
      <div
        className={`rounded-[30px] p-3 shadow-[0_12px_30px_rgba(45,51,55,0.04)] ${
          isDarkTheme ? "bg-slate-900/82" : "bg-white/92"
        }`}
      >
        {activityFeedItems.length === 0 ? (
          <div
            className={`rounded-[24px] border border-dashed px-6 py-10 text-[15px] ${
              isDarkTheme
                ? "border-slate-700/70 bg-slate-950/45 text-slate-400"
                : "border-slate-200 bg-slate-50/80 text-slate-500"
            }`}
          >
            Once gift progress or group updates start happening, your recent activity will show up here.
          </div>
        ) : (
          <div className={isDarkTheme ? "divide-y divide-slate-700/70" : "divide-y divide-slate-200/70"}>
            {activityFeedItems.slice(0, 5).map((item) => {
              const theme = getDashboardToneTheme(item.tone, isDarkTheme);
              const href = item.href;
              const content = (
                <div className="flex items-center gap-4 px-4 py-4 text-left">
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[16px] ${theme.iconShell}`}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] font-extrabold ${dashboardPanelHeadingClass}`}>
                      {item.title}
                    </span>
                    <span className={`mt-0.5 block truncate text-sm ${dashboardPanelTextClass}`}>
                      {item.subtitle}
                    </span>
                  </span>
                  <span className={`shrink-0 text-sm font-bold ${isDarkTheme ? "text-slate-500" : "text-slate-400"}`}>
                    {formatRelativeTime(item.createdAt)}
                  </span>
                  {href && <ArrowRightIcon className={`h-4 w-4 shrink-0 ${utilityIconClass}`} />}
                </div>
              );

              return href ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenPath(href)}
                  className="block w-full rounded-[20px] transition hover:bg-slate-500/5"
                >
                  {content}
                </button>
              ) : (
                <div key={item.id}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
