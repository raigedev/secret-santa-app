import type { ActionMessage } from "./dashboard-types";

type DashboardStatusMessageProps = {
  message: ActionMessage;
};

export function DashboardStatusMessage({ message }: DashboardStatusMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      data-fade
      role="status"
      aria-live="polite"
      className={`mb-6 rounded-3xl px-4 py-3 text-sm font-semibold ${
        message.type === "success"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {message.text}
    </div>
  );
}
