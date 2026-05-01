import { type GroupData } from "./group-page-state";

type GroupEventSummaryPanelProps = {
  acceptedCount: number;
  currencySymbol: string;
  drawDone: boolean;
  drawStatusLabel: string;
  groupData: GroupData;
  totalMemberCount: number;
};

export function GroupEventSummaryPanel({
  acceptedCount,
  currencySymbol,
  drawDone,
  drawStatusLabel,
  groupData,
  totalMemberCount,
}: GroupEventSummaryPanelProps) {
  const participation = totalMemberCount > 0
    ? Math.round((acceptedCount / totalMemberCount) * 100)
    : 0;
  const budgetLabel = groupData.budget
    ? `${currencySymbol}${formatBudgetAmount(groupData.budget)}`
    : "No limit";
  const giftDay = getGiftDayMeta(groupData.event_date);
  const participationDash = 138 - (138 * participation) / 100;
  const summaryCards = [
    {
      helper: giftDay.helper,
      label: giftDay.label,
      meta: "Gift day",
    },
    {
      helper: "Per person",
      label: budgetLabel,
      meta: "Group budget",
    },
    {
      helper: drawDone ? "Names are ready" : "Draw opens when ready.",
      label: drawStatusLabel,
      meta: "Draw status",
    },
  ];

  return (
    <section
      id="event-summary"
      className="rounded-3xl bg-[#fffefa] p-4 shadow-[0_18px_44px_rgba(46,52,50,.06)] ring-1 ring-[rgba(72,102,78,.12)] sm:p-5"
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
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.meta}
            className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(72,102,78,.1)]"
          >
            <p className="text-[11px] font-black text-[#5b605e]">
              {card.meta}
            </p>
            <p className="mt-2 text-[18px] font-black leading-tight text-[#48664e]">
              {card.label}
            </p>
            <p className="mt-2 text-xs font-semibold text-[#64748b]">{card.helper}</p>
          </div>
        ))}
        <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(72,102,78,.1)]">
          <p className="text-[11px] font-black text-[#5b605e]">Participation</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-[18px] font-black leading-tight text-[#48664e]">
                {acceptedCount} / {totalMemberCount}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#64748b]">
                {participation}% joined
              </p>
            </div>
            <svg viewBox="0 0 52 52" className="h-13 w-13 shrink-0" aria-hidden="true">
              <circle
                cx="26"
                cy="26"
                r="22"
                fill="none"
                stroke="rgba(72,102,78,.14)"
                strokeWidth="6"
              />
              <circle
                cx="26"
                cy="26"
                r="22"
                fill="none"
                stroke="#48664e"
                strokeDasharray="138"
                strokeDashoffset={participationDash}
                strokeLinecap="round"
                strokeWidth="6"
                transform="rotate(-90 26 26)"
              />
              <text
                x="26"
                y="30"
                fill="#48664e"
                fontSize="11"
                fontWeight="900"
                textAnchor="middle"
              >
                {participation}%
              </text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatBudgetAmount(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
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

function getGiftDayMeta(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      helper: "Date not set",
      label: value || "Not set",
    };
  }

  const today = new Date();
  const parsedDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntil = Math.round((parsedDay.getTime() - todayDay.getTime()) / 86400000);

  if (daysUntil > 0) {
    return {
      helper: `In ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
      label: formatEventDate(value),
    };
  }

  if (daysUntil === 0) {
    return {
      helper: "Today",
      label: formatEventDate(value),
    };
  }

  return {
    helper: "Gift day passed",
    label: formatEventDate(value),
  };
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
