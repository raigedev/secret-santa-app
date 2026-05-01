import { GiftIcon } from "@/app/dashboard/dashboard-icons";
import type { HistoryWishlistItem } from "@/app/history/HistoryGroupCard";

export function LinkIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M8.2 11.8a3.1 3.1 0 0 1 0-4.4l1.8-1.8a3.1 3.1 0 1 1 4.4 4.4l-1 1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <path
        d="M11.8 8.2a3.1 3.1 0 0 1 0 4.4L10 14.4A3.1 3.1 0 1 1 5.6 10l1-1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4.5 6h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M8 4.2h4M7 8v6M10 8v6M13 8v6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path
        d="M6 6.3 6.7 16a1.7 1.7 0 0 0 1.7 1.5h3.2a1.7 1.7 0 0 0 1.7-1.5l.7-9.7"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function SparkMark() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff6dc] text-[#7b5902]">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
        <path
          d="M12 3.5c1.1 4 2.7 5.9 6.6 7-3.9 1.1-5.5 3-6.6 7-1.1-4-2.7-5.9-6.6-7 3.9-1.1 5.5-3 6.6-7Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    </span>
  );
}

export function PineCorner() {
  return (
    <svg viewBox="0 0 160 140" className="pointer-events-none absolute -right-8 -top-8 hidden h-40 w-44 text-[#48664e] opacity-70 lg:block" fill="none" aria-hidden="true">
      <path d="M150 2C117 31 82 55 42 77" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <g key={item} transform={`translate(${34 + item * 15} ${76 - item * 12}) rotate(${-31 + item * 4})`}>
          <path d="M0 0h42" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
          <path d="M12 0 0 14M24 0 8 18M36 0 18 20" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
        </g>
      ))}
      <path d="M124 32c7-3 14 1 16 8-8 2-15-1-16-8Z" fill="#7b5902" opacity=".5" />
      <circle cx="112" cy="28" r="3" fill="#a43c3f" />
    </svg>
  );
}

export function WishlistMemoryThumbnail({ item }: { item: HistoryWishlistItem }) {
  const label = `${item.item_name} ${item.item_category || ""}`.toLowerCase();
  const isTablet = label.includes("tablet") || label.includes("galaxy") || label.includes("ipad");
  const isPower = label.includes("power") || label.includes("bank") || label.includes("charger");
  const isAudio = label.includes("headphone") || label.includes("earbud") || label.includes("speaker");

  return (
    <span className="relative flex h-28 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f3f4f2]">
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(252,206,114,.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.9),rgba(236,239,236,.72))]" />
      {isTablet ? (
        <span className="relative h-20 w-16 rounded-xl bg-[#2e3432] p-1 shadow-[0_14px_22px_rgba(46,52,50,.16)]">
          <span className="block h-full rounded-lg bg-[radial-gradient(circle_at_35%_30%,#fcce72,transparent_18%),radial-gradient(circle_at_70%_58%,#a43c3f,transparent_20%),linear-gradient(135deg,#dce8f3,#87a4c5)]" />
        </span>
      ) : isPower ? (
        <span className="relative h-14 w-22 rounded-2xl bg-[#2e3432] shadow-[0_14px_22px_rgba(46,52,50,.16)]">
          <span className="absolute left-3 top-3 h-2 w-8 rounded-full bg-white/18" />
          <span className="absolute bottom-3 left-3 h-2 w-12 rounded-full bg-white/12" />
          <span className="absolute right-2 top-4 h-6 w-1 rounded-full bg-[#fcce72]" />
        </span>
      ) : isAudio ? (
        <span className="relative h-20 w-20 rounded-full border-6 border-[#d8d0bd]">
          <span className="absolute -bottom-3 left-0 h-10 w-7 rounded-full bg-[#efe6d4]" />
          <span className="absolute -bottom-3 right-0 h-10 w-7 rounded-full bg-[#efe6d4]" />
        </span>
      ) : (
        <span className="relative flex h-18 w-18 items-center justify-center rounded-3xl bg-white text-[#a43c3f] shadow-[0_14px_22px_rgba(46,52,50,.1)]">
          <GiftIcon className="h-9 w-9" />
        </span>
      )}
    </span>
  );
}
