import { type GroupData } from "./group-page-state";

type GroupEventSummaryPanelProps = {
  acceptedCount: number;
  currencySymbol: string;
  declinedCount: number;
  drawDone: boolean;
  drawStatusLabel: string;
  groupData: GroupData;
  isOwner: boolean;
  pendingCount: number;
  totalMemberCount: number;
  onOpenDelete: () => void;
  onOpenEdit: () => void;
  onOpenLeave: () => void;
};

export function GroupEventSummaryPanel({
  acceptedCount,
  currencySymbol,
  declinedCount,
  drawDone,
  drawStatusLabel,
  groupData,
  isOwner,
  pendingCount,
  totalMemberCount,
  onOpenDelete,
  onOpenEdit,
  onOpenLeave,
}: GroupEventSummaryPanelProps) {
  const participation = totalMemberCount > 0
    ? Math.round((acceptedCount / totalMemberCount) * 100)
    : 0;
  const budgetLabel = groupData.budget ? `${currencySymbol}${groupData.budget}` : "No limit";
  const summaryCards = [
    {
      helper: "Gift day",
      label: formatEventDate(groupData.event_date),
      meta: "Event date",
    },
    {
      helper: "Per person",
      label: budgetLabel,
      meta: "Group budget",
    },
    {
      helper: drawDone ? "Names are ready" : "Draw opens when ready",
      label: drawStatusLabel,
      meta: "Draw status",
    },
    {
      helper: `${participation}% joined`,
      label: `${acceptedCount} / ${totalMemberCount}`,
      meta: "Participation",
    },
  ];

  return (
    <section
      className="rounded-[26px] bg-white p-4 shadow-[0_18px_44px_rgba(46,52,50,.06)] sm:p-5"
      aria-label="Event summary"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon />
            <h2 className="text-[18px] font-black text-[#2e3432]">Event summary</h2>
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#64748b]">
            Key dates and details for your exchange.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={onOpenEdit}
                className="rounded-full bg-[#f2f4f2] px-4 py-2 text-xs font-black text-[#48664e]"
              >
                Edit group
              </button>
              <button
                type="button"
                onClick={onOpenDelete}
                className="rounded-full bg-[#fff7f6] px-4 py-2 text-xs font-black text-[#a43c3f]"
              >
                Delete group
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenLeave}
              disabled={drawDone}
              className="rounded-full bg-[#fff4df] px-4 py-2 text-xs font-black text-[#7b5902] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {drawDone ? "Group locked" : "Leave group"}
            </button>
          )}
        </div>
      </div>

      {groupData.description && (
        <div className="mb-4 rounded-[18px] bg-[#f8faf7] px-4 py-3 text-sm font-semibold leading-6 text-[#5b605e]">
          {groupData.description}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.meta}
            className="rounded-[18px] bg-[#fbfcfa] p-4 shadow-[inset_0_0_0_1px_rgba(72,102,78,.08)]"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#64748b]">
              {card.meta}
            </p>
            <p className="mt-2 text-[18px] font-black leading-tight text-[#48664e]">
              {card.label}
            </p>
            <p className="mt-2 text-xs font-semibold text-[#64748b]">{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          { count: acceptedCount, label: "Accepted", tone: "#48664e" },
          { count: pendingCount, label: "Pending", tone: "#7b5902" },
          { count: declinedCount, label: "Declined", tone: "#a43c3f" },
          { count: totalMemberCount, label: "Total", tone: "#2e3432" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-full bg-[#f2f4f2] px-3 py-2 text-center">
            <span className="text-sm font-black" style={{ color: stat.tone }}>
              {stat.count}
            </span>
            <span className="ml-1 text-xs font-bold text-[#64748b]">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatEventDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || "Not set";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#48664e]" fill="none" aria-hidden="true">
      <path
        d="M7 4.5v3M17 4.5v3M5.5 9.5h13M6.8 6.5h10.4c1 0 1.8.8 1.8 1.8v9.4c0 1-.8 1.8-1.8 1.8H6.8c-1 0-1.8-.8-1.8-1.8V8.3c0-1 .8-1.8 1.8-1.8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
