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

  return (
    <div
      className="rounded-[18px] p-5 mb-5"
      style={{
        background: "rgba(255,255,255,.76)",
        border: "1px solid rgba(255,255,255,.92)",
        boxShadow: "0 10px 24px rgba(15,23,42,.05)",
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Fredoka', sans-serif", color: "#14532d" }}
          >
            {"\uD83D\uDD0E"} Owner Insights
          </div>
          <div className="text-[12px] font-semibold mt-1" style={{ color: "#64748b" }}>
            Quick readiness signals for this group. Private chat stays summarized here so
            surprises stay private.
          </div>
        </div>

        <div
          className="px-3 py-1.5 rounded-full text-[11px] font-extrabold"
          style={{
            background: drawDone ? "rgba(30,64,175,.08)" : "rgba(21,128,61,.08)",
            color: drawDone ? "#1d4ed8" : "#15803d",
          }}
        >
          {drawDone ? "After names are drawn" : "Before names are drawn"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(21,128,61,.05)",
            border: "1px solid rgba(21,128,61,.1)",
          }}
        >
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: "#15803d" }}
          >
            Wishlist Coverage
          </div>
          <div
            className="text-[26px] font-bold mt-2"
            style={{ color: "#14532d", fontFamily: "'Fredoka', sans-serif" }}
          >
            {ownerInsights.wishlistReadyCount}/{ownerInsights.acceptedCount}
          </div>
          <div
            className="text-[12px] font-semibold mt-1"
            style={{ color: "#64748b", lineHeight: 1.45 }}
          >
            {ownerInsights.missingWishlistMemberNames.length === 0
              ? "Every accepted member has at least one wishlist item."
              : `${ownerInsights.missingWishlistMemberNames.length} accepted member${
                  ownerInsights.missingWishlistMemberNames.length === 1 ? "" : "s"
                } still need a wishlist.`}
          </div>
        </div>

        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(37,99,235,.05)",
            border: "1px solid rgba(37,99,235,.1)",
          }}
        >
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: "#2563eb" }}
          >
            Anonymous Chat
          </div>
          <div
            className="text-[26px] font-bold mt-2"
            style={{ color: "#1d4ed8", fontFamily: "'Fredoka', sans-serif" }}
          >
            {ownerInsights.totalChatThreadCount > 0
              ? `${ownerInsights.activeChatThreadCount}/${ownerInsights.totalChatThreadCount}`
              : "After draw"}
          </div>
          <div
            className="text-[12px] font-semibold mt-1"
            style={{ color: "#64748b", lineHeight: 1.45 }}
          >
            {ownerInsights.totalChatThreadCount > 0
              ? `${ownerInsights.activeChatThreadCount} thread${
                  ownerInsights.activeChatThreadCount === 1 ? "" : "s"
                } have at least one message.`
              : "Threads open once names are drawn, but identities stay hidden from you."}
          </div>
        </div>

        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(184,131,29,.06)",
            border: "1px solid rgba(184,131,29,.12)",
          }}
        >
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: "#b45309" }}
          >
            Gift Confirmations
          </div>
          <div
            className="text-[26px] font-bold mt-2"
            style={{ color: "#92400e", fontFamily: "'Fredoka', sans-serif" }}
          >
            {ownerInsights.totalGiftCount > 0
              ? `${ownerInsights.confirmedGiftCount}/${ownerInsights.totalGiftCount}`
              : "After draw"}
          </div>
          <div
            className="text-[12px] font-semibold mt-1"
            style={{ color: "#64748b", lineHeight: 1.45 }}
          >
            {ownerInsights.totalGiftCount > 0
              ? `${Math.max(
                  ownerInsights.totalGiftCount - ownerInsights.confirmedGiftCount,
                  0
                )} gift confirmation${
                  ownerInsights.totalGiftCount - ownerInsights.confirmedGiftCount === 1
                    ? ""
                    : "s"
                } still pending.`
              : "Recipients can confirm once gifts start getting handed out."}
          </div>
        </div>
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
