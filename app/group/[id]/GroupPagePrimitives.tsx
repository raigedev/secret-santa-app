import type { ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
};

type HistorySkeletonRowsProps = {
  tone?: "blue" | "orange";
};

export function GroupPageModal({ children, onClose }: ModalProps) {
  return (
    <div
      data-app-modal="true"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-105 rounded-[20px] p-7"
        style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.18)" }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function HistorySkeletonRows({ tone = "blue" }: HistorySkeletonRowsProps) {
  const border = tone === "orange" ? "rgba(249,115,22,.2)" : "rgba(37,99,235,.18)";
  const base = tone === "orange" ? "rgba(255,247,237,.95)" : "rgba(248,250,252,.95)";

  return (
    <div className="space-y-2">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="rounded-lg px-2.5 py-2"
          style={{
            background: base,
            border: `1px solid ${border}`,
          }}
        >
          <div
            className="h-2.5 w-3/4 rounded"
            style={{ background: "rgba(148,163,184,.28)" }}
          />
          <div
            className="mt-2 h-2 w-1/2 rounded"
            style={{ background: "rgba(148,163,184,.22)" }}
          />
        </div>
      ))}
    </div>
  );
}
