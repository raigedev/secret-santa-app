import { type OwnerInsights } from "./group-page-state";

type GroupOwnerInsightsPanelProps = {
  drawDone: boolean;
  eventDate: string;
  ownerInsights: OwnerInsights;
};

type HealthRow = {
  accent: string;
  helper: string;
  label: string;
  meta: string;
  tone: string;
};

export function GroupOwnerInsightsPanel({
  drawDone,
  eventDate,
  ownerInsights,
}: GroupOwnerInsightsPanelProps) {
  const missingWishlistCount = ownerInsights.missingWishlistMemberNames.length;
  const pendingInvites = Math.max(
    ownerInsights.acceptedCount - ownerInsights.wishlistReadyCount,
    0
  );
  const giftDateLabel = formatEventDate(eventDate);
  const rows: HealthRow[] = [
    {
      accent: "#a43c3f",
      helper:
        pendingInvites > 0
          ? "There are invites or member steps that need attention."
          : "Members are in good shape.",
      label: "Invites",
      meta: pendingInvites > 0 ? `${pendingInvites} pending` : "All set",
      tone: "rgba(164,60,63,.1)",
    },
    {
      accent: "#a43c3f",
      helper:
        missingWishlistCount > 0
          ? `${missingWishlistCount} member${missingWishlistCount === 1 ? "" : "s"} missing wishlist items.`
          : "Every accepted member has a wishlist item.",
      label: "Wishlists",
      meta: missingWishlistCount > 0 ? `${missingWishlistCount} missing` : "Ready",
      tone: missingWishlistCount > 0 ? "rgba(164,60,63,.1)" : "rgba(72,102,78,.12)",
    },
    {
      accent: "#7b5902",
      helper: drawDone ? "Names have been drawn for this exchange." : "Names can be drawn once the group is ready.",
      label: "Draw status",
      meta: drawDone ? "Drawn" : "Ready soon",
      tone: "rgba(252,206,114,.28)",
    },
    {
      accent: "#48664e",
      helper:
        ownerInsights.totalChatThreadCount > 0
          ? `${ownerInsights.activeChatThreadCount} private conversation${ownerInsights.activeChatThreadCount === 1 ? "" : "s"} active.`
          : "No active conversations yet.",
      label: "Messages",
      meta: ownerInsights.activeChatThreadCount > 0 ? "Active" : "Quiet",
      tone: "rgba(72,102,78,.12)",
    },
    {
      accent: "#48664e",
      helper: "Keep the date visible so members can plan their gifts.",
      label: "Gift day",
      meta: giftDateLabel,
      tone: "rgba(72,102,78,.12)",
    },
  ];

  return (
    <aside
      className="rounded-[28px] bg-white p-4 shadow-[0_24px_70px_rgba(46,52,50,.08)] lg:sticky lg:top-25"
      aria-label="Exchange health"
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
          style={{ background: "rgba(72,102,78,.12)", color: "#48664e" }}
          aria-hidden="true"
        >
          <HealthIcon />
        </span>
        <div>
          <h2 className="text-[18px] font-black leading-tight text-[#48664e]">
            Exchange health
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#64748b]">
            Keep your exchange on track.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-[18px] bg-[#fbfcfa] p-4 shadow-[inset_0_0_0_1px_rgba(72,102,78,.08)]"
          >
            <div className="flex items-start gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                style={{ background: row.tone, color: row.accent }}
                aria-hidden="true"
              >
                <StatusIcon />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-black leading-tight text-[#2e3432]">
                    {row.label}
                  </p>
                  <span className="text-[11px] font-black" style={{ color: row.accent }}>
                    {row.meta}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#64748b]">
                  {row.helper}
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#48664e]"
                >
                  {getRowAction(row.label)}
                  <ChevronIcon />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[18px] bg-[#eef3ef] px-4 py-3 text-xs font-bold leading-5 text-[#48664e]">
        Tip: send reminders early to help everyone stay on track.
      </div>
    </aside>
  );
}

function formatEventDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not set";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRowAction(label: string): string {
  if (label === "Invites" || label === "Wishlists") {
    return "Send reminder";
  }
  if (label === "Draw status") {
    return "Draw names";
  }
  if (label === "Messages") {
    return "View messages";
  }
  return "View event details";
}

function HealthIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.2 8.3 8.4l3.3 3.3 2.7-6.2 5.2 6.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 16.5h15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M5.5 12.2h13M12 5.7v13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="m7.5 4.8 5.2 5.2-5.2 5.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
