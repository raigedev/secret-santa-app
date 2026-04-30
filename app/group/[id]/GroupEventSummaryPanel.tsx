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
  const eventStats = [
    { icon: "\uD83D\uDCC5", value: groupData.event_date, label: "Gift date" },
    {
      icon: "\uD83D\uDCB0",
      value: groupData.budget ? `${currencySymbol}${groupData.budget}` : "No limit",
      label: "Budget",
    },
    { icon: "\uD83D\uDC65", value: `${totalMemberCount}`, label: "Members" },
    { icon: "\uD83C\uDFB2", value: drawStatusLabel, label: "Name draw" },
  ];
  const memberStats = [
    { count: acceptedCount, label: "Accepted", color: "#15803d", border: "#22c55e" },
    { count: pendingCount, label: "Pending", color: "#b45309", border: "#f59e0b" },
    { count: declinedCount, label: "Declined", color: "#dc2626", border: "#dc2626" },
    { count: totalMemberCount, label: "Total", color: "#1d4ed8", border: "#2563eb" },
  ];

  return (
    <>
      {groupData.description && (
        <div
          className="rounded-xl overflow-hidden mb-4"
          style={{
            background: "rgba(127,29,29,.04)",
            border: "1px solid rgba(127,29,29,.08)",
          }}
        >
          <div
            className="flex items-center gap-1.5 px-3.5 py-2"
            style={{
              background: "rgba(127,29,29,.04)",
              borderBottom: "1px solid rgba(127,29,29,.06)",
              fontSize: "10px",
              fontWeight: 800,
              color: "#991b1b",
              textTransform: "uppercase",
              letterSpacing: ".08em",
            }}
          >
            {"\uD83D\uDCCB"} Group notes and rules
          </div>

          <div className="px-3.5 py-2.5" style={{ fontSize: "13px", color: "#4b5563", lineHeight: 1.6 }}>
            {groupData.description}
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {eventStats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl px-4 py-4"
            style={{
              background: "rgba(255,255,255,.78)",
              border: "1px solid rgba(255,255,255,.92)",
            }}
          >
            <div className="text-[18px] mb-1">{item.icon}</div>
            <div className="text-[16px] font-bold text-gray-800">{item.value}</div>
            <div className="text-[11px] font-semibold text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>

      {isOwner ? (
        <div className="flex gap-2 justify-center mb-5 flex-wrap">
          <button
            type="button"
            onClick={onOpenEdit}
            className="px-4 py-2 rounded-lg text-[11px] font-bold transition"
            style={{
              background: "rgba(59,130,246,.08)",
              color: "#3b82f6",
              border: "1px solid rgba(59,130,246,.15)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {"\u270F\uFE0F"} Edit Group
          </button>

          <button
            type="button"
            onClick={onOpenDelete}
            className="px-4 py-2 rounded-lg text-[11px] font-bold transition"
            style={{
              background: "rgba(220,38,38,.06)",
              color: "#ef4444",
              border: "1px solid rgba(220,38,38,.12)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {"\uD83D\uDDD1\uFE0F"} Delete Group
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 mb-5">
          <button
            type="button"
            onClick={onOpenLeave}
            disabled={drawDone}
            className="px-4 py-2 rounded-lg text-[11px] font-bold transition"
            style={{
              background: "rgba(245,158,11,.08)",
              color: drawDone ? "#9ca3af" : "#f59e0b",
              border: "1px solid rgba(245,158,11,.12)",
              cursor: drawDone ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: drawDone ? 0.7 : 1,
            }}
          >
            {drawDone ? "Group locked" : "\uD83D\uDEAA Leave Group"}
          </button>

          {drawDone && (
            <p className="text-center text-[11px]" style={{ color: "#6b7280" }}>
              Member changes are locked after names are drawn. Ask the owner to reset first.
            </p>
          )}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {memberStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl py-4 px-3 text-center relative overflow-hidden"
            style={{
              background: "rgba(255,255,255,.78)",
              border: "1px solid rgba(255,255,255,.92)",
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: stat.border }} />
            <div
              className="text-2xl font-bold leading-none"
              style={{ fontFamily: "'Fredoka', sans-serif", color: stat.color }}
            >
              {stat.count}
            </div>
            <div className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wide">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
