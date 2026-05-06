import type { ReactNode } from "react";
import { GiftIcon } from "./dashboard-icons";

export function GroupGiftBadge({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,0.12),0_12px_26px_rgba(72,102,78,0.08)]">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <GiftIcon className="h-8 w-8" />
      )}
      <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-[#fcce72]" />
    </span>
  );
}

export function MetaItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {label}
    </span>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="4" y="5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 3.5v3M13 3.5v3M4 8.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BudgetIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4.5 7.5h11v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5M12.5 11h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
