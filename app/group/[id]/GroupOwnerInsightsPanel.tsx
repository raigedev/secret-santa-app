import { type OwnerInsights } from "./group-page-state";

type GroupOwnerInsightsPanelProps = {
  canDrawNames: boolean;
  declinedMemberCount: number;
  drawDone: boolean;
  drawRulesReady: boolean;
  eventDate: string;
  ownerInsights: OwnerInsights;
  pendingMemberCount: number;
  pendingInviteCount: number;
};

type HealthRow = {
  accent: string;
  action: string;
  helper: string;
  href: string;
  icon: "calendar" | "heart" | "invite" | "people";
  label: string;
  meta: string;
  tone: string;
};

export function GroupOwnerInsightsPanel({
  canDrawNames,
  declinedMemberCount,
  drawDone,
  drawRulesReady,
  eventDate,
  ownerInsights,
  pendingMemberCount,
  pendingInviteCount,
}: GroupOwnerInsightsPanelProps) {
  const missingWishlistCount = ownerInsights.missingWishlistMemberNames.length;
  const giftDateLabel = formatEventDate(eventDate);
  const giftDayMeta = getGiftDayHelper(eventDate);
  const blockedMemberCount = pendingMemberCount + declinedMemberCount;
  const drawMeta = getDrawStatusMeta({
    blockedMemberCount,
    canDrawNames,
    drawDone,
    drawRulesReady,
    eventDate,
  });
  const rows: HealthRow[] = [
    {
      accent: "#a43c3f",
      action: "Send reminders",
      helper:
        pendingInviteCount > 0
          ? `There ${pendingInviteCount === 1 ? "is" : "are"} ${pendingInviteCount} invite${pendingInviteCount === 1 ? "" : "s"} that haven't been accepted.`
          : "Every invite has been accepted.",
      href: "#member-management",
      icon: "invite",
      label: "Invites",
      meta: pendingInviteCount > 0 ? `${pendingInviteCount} pending` : "All set",
      tone: "rgba(164,60,63,.1)",
    },
    {
      accent: "#a43c3f",
      action: "Send reminder",
      helper:
        missingWishlistCount > 0
          ? `${missingWishlistCount} member${missingWishlistCount === 1 ? " hasn't" : "s haven't"} added a wishlist yet.`
          : "Every accepted member has a wishlist item.",
      href: "#group-members",
      icon: "heart",
      label: "Wishlists",
      meta: missingWishlistCount > 0 ? `${missingWishlistCount} missing` : "Ready",
      tone: missingWishlistCount > 0 ? "rgba(164,60,63,.1)" : "rgba(72,102,78,.12)",
    },
    {
      accent: "#7b5902",
      action: drawMeta.action,
      helper: drawMeta.helper,
      href: drawMeta.href,
      icon: "people",
      label: "Draw status",
      meta: drawMeta.meta,
      tone: "rgba(252,206,114,.28)",
    },
    {
      accent: "#48664e",
      action: "View event details",
      helper: giftDayMeta,
      href: "#event-summary",
      icon: "calendar",
      label: "Gift day",
      meta: giftDateLabel,
      tone: "rgba(72,102,78,.12)",
    },
  ];

  return (
    <aside
      className="holiday-panel rounded-3xl p-4 xl:sticky xl:top-26"
      aria-label="Exchange health"
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7f1e7] text-[#48664e]"
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
            className="holiday-panel-row rounded-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
                style={{ background: row.tone, color: row.accent }}
                aria-hidden="true"
              >
                <HealthRowIcon icon={row.icon} />
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
                <a
                  href={row.href}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#48664e]"
                >
                  {row.action}
                  <ChevronIcon />
                </a>
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

export function GroupOwnerInsightsSkeleton() {
  return (
    <aside
      className="holiday-panel rounded-3xl p-4 xl:sticky xl:top-26"
      aria-label="Exchange health loading"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="h-11 w-11 shrink-0 rounded-full bg-[#e7f1e7]" />
        <div className="min-w-0 flex-1">
          <div className="h-5 w-38 rounded-full bg-[#e7ece7]" />
          <div className="mt-2 h-3 w-44 rounded-full bg-[#eef3ef]" />
        </div>
      </div>
      <div className="space-y-3">
        {["invites", "wishlists", "draw", "gift-day"].map((item) => (
          <div
            key={item}
            className="holiday-panel-row rounded-2xl p-4"
          >
            <div className="flex gap-3">
              <span className="h-12 w-12 shrink-0 rounded-full bg-[#f2f4f2]" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-26 rounded-full bg-[#e7ece7]" />
                <div className="mt-2 h-3 w-full rounded-full bg-[#f2f4f2]" />
                <div className="mt-2 h-3 w-28 rounded-full bg-[#eef3ef]" />
              </div>
            </div>
          </div>
        ))}
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

function getGiftDayHelper(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Add a gift day so members can plan.";
  }

  const today = new Date();
  const parsedDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntil = Math.round((parsedDay.getTime() - todayDay.getTime()) / 86400000);

  if (daysUntil > 0) {
    return `${daysUntil} day${daysUntil === 1 ? "" : "s"} left until gift day. You're all set.`;
  }

  if (daysUntil === 0) {
    return "Gift day is today. Keep the exchange moving.";
  }

  return "Gift day passed. Wrap up final confirmations.";
}

function getDrawStatusMeta({
  blockedMemberCount,
  canDrawNames,
  drawDone,
  drawRulesReady,
  eventDate,
}: {
  blockedMemberCount: number;
  canDrawNames: boolean;
  drawDone: boolean;
  drawRulesReady: boolean;
  eventDate: string;
}) {
  if (drawDone) {
    return {
      action: "View matches",
      helper: "Names have been drawn for this exchange.",
      href: "#draw-controls",
      meta: "Drawn",
    };
  }

  if (!drawRulesReady) {
    return {
      action: "Review setup",
      helper: "Draw setup is still loading.",
      href: "#draw-controls",
      meta: "Loading",
    };
  }

  if (canDrawNames) {
    return {
      action: "Draw names",
      helper: "All accepted members are ready for the draw.",
      href: "#draw-controls",
      meta: "Ready now",
    };
  }

  if (blockedMemberCount > 0) {
    return {
      action: "Review members",
      helper: `${blockedMemberCount} member${blockedMemberCount === 1 ? "" : "s"} still need attention before drawing.`,
      href: "#group-members",
      meta: "Waiting",
    };
  }

  return {
    action: "Review setup",
    helper: `Names can be drawn around ${formatEventDate(eventDate)}.`,
    href: "#draw-controls",
    meta: "Ready soon",
  };
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

function HealthRowIcon({ icon }: { icon: HealthRow["icon"] }) {
  if (icon === "invite") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path
          d="M5.5 7.5h13v9h-13v-9Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="m6.2 8.2 5.8 4.7 5.8-4.7M6.6 16l4-4M17.4 16l-4-4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (icon === "heart") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path
          d="M12 18.6s-6.5-3.9-6.5-8.2A3.6 3.6 0 0 1 12 8.2a3.6 3.6 0 0 1 6.5 2.2c0 4.3-6.5 8.2-6.5 8.2Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (icon === "people") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path
          d="M8.4 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM15.8 10.4a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM3.6 18.8c.6-3.3 2.4-5 5-5s4.4 1.7 5 5M12.8 14.2c.8-.7 1.8-1.1 3-1.1 2.4 0 4 1.5 4.6 4.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M7 4.8v3M17 4.8v3M5.2 9.8h13.6M6.7 6.7h10.6c1 0 1.9.8 1.9 1.9v8.9c0 1-.8 1.9-1.9 1.9H6.7c-1 0-1.9-.8-1.9-1.9V8.6c0-1 .8-1.9 1.9-1.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
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
