import { formatDashboardBudget } from "./dashboard-formatters";
import { ArrowRightIcon, GiftIcon } from "./dashboard-icons";
import { getPanelClass } from "./DashboardMissionBoardPanels";
import type { Group } from "./dashboard-types";

export function MemoryBookPreview({
  groups,
  isDarkTheme,
  mutedTextClass,
  onNavigate,
  pastPreviewGroups,
}: {
  groups: Group[];
  isDarkTheme: boolean;
  mutedTextClass: string;
  onNavigate: (path: string) => void;
  pastPreviewGroups: Group[];
}) {
  const previewGroups = pastPreviewGroups.length > 0 ? pastPreviewGroups.slice(0, 2) : groups.slice(0, 2);

  return (
    <section className={`rounded-3xl p-5 shadow-[0_16px_40px_rgba(46,52,50,.05)] ${getPanelClass(isDarkTheme)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[22px] font-black">Memory book</h3>
          <p className={`mt-1 text-[13px] font-semibold ${mutedTextClass}`}>
            Concluded exchanges and past wishlist shelves live in History.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("/history")}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#48664e]/10 px-4 text-[12px] font-black text-[#48664e] transition hover:-translate-y-0.5"
        >
          View all history
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {previewGroups.map((group) => {
          const isPast = pastPreviewGroups.includes(group);

          return (
            <div key={group.id} className={`rounded-3xl p-4 ${isDarkTheme ? "bg-slate-950/42" : "bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-black">{group.name}</p>
                  <p className={`mt-1 text-[11px] font-semibold ${mutedTextClass}`}>
                    {group.members.length} members / {formatDashboardBudget(group.budget, group.currency) || "No budget"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-black ${
                    isDarkTheme ? "bg-slate-800 text-slate-400" : "bg-[#f2f4f2] text-slate-500"
                  }`}
                >
                  {isPast ? "Archived" : "Active"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(isPast ? "/history" : `/group/${group.id}`)}
                className={`mt-4 w-full rounded-full px-4 py-2 text-[12px] font-black transition hover:-translate-y-0.5 ${
                  isDarkTheme ? "bg-slate-800 text-slate-200" : "bg-[#f2f4f2] text-slate-600"
                }`}
              >
                {isPast ? "View gift shelf" : "Open exchange"}
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onNavigate("/history")}
          className={`flex min-h-32 flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition hover:-translate-y-0.5 ${
            isDarkTheme ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#48664e]">
            <GiftIcon className="h-5 w-5" />
          </span>
          <span className="mt-3 text-[13px] font-black">Open past exchanges</span>
        </button>
      </div>
    </section>
  );
}
