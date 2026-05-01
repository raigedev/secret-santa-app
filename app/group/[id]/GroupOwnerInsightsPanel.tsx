import { type OwnerInsights } from "./group-page-state";

type GroupOwnerInsightsPanelProps = {
  drawDone: boolean;
  ownerInsights: OwnerInsights;
};

export function GroupOwnerInsightsPanel({
  drawDone,
  ownerInsights,
}: GroupOwnerInsightsPanelProps) {
  const missingWishlistPreview = ownerInsights.missingWishlistMemberNames.slice(0, 4);
  const extraMissingWishlistCount = Math.max(
    ownerInsights.missingWishlistMemberNames.length - missingWishlistPreview.length,
    0
  );
  const wishlistPercent = getPercent(
    ownerInsights.wishlistReadyCount,
    ownerInsights.acceptedCount
  );
  const chatPercent = getPercent(
    ownerInsights.activeChatThreadCount,
    ownerInsights.totalChatThreadCount
  );
  const giftPercent = getPercent(
    ownerInsights.confirmedGiftCount,
    ownerInsights.totalGiftCount
  );
  const readinessRows = [
    {
      helper:
        ownerInsights.missingWishlistMemberNames.length === 0
          ? "Every accepted member has at least one wishlist item."
          : `${ownerInsights.missingWishlistMemberNames.length} accepted member${
              ownerInsights.missingWishlistMemberNames.length === 1 ? "" : "s"
            } still need a wishlist.`,
      label: "Wishlists",
      percent: wishlistPercent,
      value: `${ownerInsights.wishlistReadyCount}/${ownerInsights.acceptedCount}`,
    },
    {
      helper:
        ownerInsights.totalChatThreadCount > 0
          ? `${ownerInsights.activeChatThreadCount} private thread${
              ownerInsights.activeChatThreadCount === 1 ? "" : "s"
            } have a message.`
          : "Threads open once names are drawn.",
      label: "Private messages",
      percent: chatPercent,
      value:
        ownerInsights.totalChatThreadCount > 0
          ? `${ownerInsights.activeChatThreadCount}/${ownerInsights.totalChatThreadCount}`
          : "After draw",
    },
    {
      helper:
        ownerInsights.totalGiftCount > 0
          ? `${Math.max(
              ownerInsights.totalGiftCount - ownerInsights.confirmedGiftCount,
              0
            )} confirmation${
              ownerInsights.totalGiftCount - ownerInsights.confirmedGiftCount === 1 ? "" : "s"
            } still pending.`
          : "Recipients can confirm gifts after the exchange.",
      label: "Gift progress",
      percent: giftPercent,
      value:
        ownerInsights.totalGiftCount > 0
          ? `${ownerInsights.confirmedGiftCount}/${ownerInsights.totalGiftCount}`
          : "After draw",
    },
  ];

  return (
    <div
      className="mb-5 rounded-[28px] p-5"
      style={{
        background:
          "linear-gradient(135deg,rgba(255,255,255,.94),rgba(239,247,241,.9))",
        border: "1px solid rgba(72,102,78,.16)",
        boxShadow: "0 18px 42px rgba(46,52,50,.06)",
      }}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div
            className="text-[20px] font-black"
            style={{ fontFamily: "'Fredoka', sans-serif", color: "#48664e" }}
          >
            Exchange health
          </div>
          <div className="mt-1 max-w-2xl text-[12px] font-semibold leading-5" style={{ color: "#64748b" }}>
            Readiness signals for invites, wishlists, messages, and gift progress. Private details stay private.
          </div>
        </div>

        <div
          className="rounded-full px-3 py-1.5 text-[11px] font-extrabold"
          style={{
            background: drawDone ? "rgba(72,102,78,.1)" : "rgba(252,206,114,.22)",
            color: drawDone ? "#48664e" : "#7b5902",
          }}
        >
          {drawDone ? "Names drawn" : "Before draw"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {readinessRows.map((row) => (
          <div
            key={row.label}
            className="rounded-[22px] p-4"
            style={{
              background: "rgba(255,255,255,.78)",
              border: "1px solid rgba(72,102,78,.12)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div
                className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                style={{ color: "#48664e" }}
              >
                {row.label}
              </div>
              <div className="text-[13px] font-black" style={{ color: "#2e3432" }}>
                {row.value}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ecefec]">
              <div
                className="h-full rounded-full bg-[#48664e]"
                style={{ width: `${row.percent}%` }}
              />
            </div>
            <div
              className="mt-3 text-[12px] font-semibold leading-5"
              style={{ color: "#64748b" }}
            >
              {row.helper}
            </div>
          </div>
        ))}
      </div>

      {ownerInsights.missingWishlistMemberNames.length > 0 && (
        <div className="mt-4">
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.12em] mb-2"
            style={{ color: "#b45309" }}
          >
            Still missing a wishlist
          </div>
          <div className="flex flex-wrap gap-2">
            {missingWishlistPreview.map((memberName) => (
              <span
                key={memberName}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                style={{
                  background: "rgba(251,191,36,.14)",
                  color: "#92400e",
                  border: "1px solid rgba(251,191,36,.24)",
                }}
              >
                {memberName}
              </span>
            ))}

            {extraMissingWishlistCount > 0 && (
              <span
                className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                style={{
                  background: "rgba(148,163,184,.12)",
                  color: "#475569",
                  border: "1px solid rgba(148,163,184,.2)",
                }}
              >
                +{extraMissingWishlistCount} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getPercent(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(Math.max(Math.round((value / total) * 100), 0), 100);
}
