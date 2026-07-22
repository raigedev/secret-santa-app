"use client";

import Link from "next/link";

type AppPageBackNavigationProps = {
  className?: string;
  label: string;
} & (
  | {
      href: string;
      onClick?: never;
    }
  | {
      href?: never;
      onClick: () => void;
    }
);

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="m12.5 4.5-5.5 5.5 5.5 5.5M7.5 10h7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function AppPageBackNavigation({
  className,
  label,
  ...destination
}: AppPageBackNavigationProps) {
  const controlClassName =
    "group inline-flex min-h-11 w-fit items-center gap-2 rounded-xl px-1.5 pr-3 text-sm font-extrabold text-[#48664e] transition-[background-color,color,box-shadow] hover:bg-white/75 hover:text-[#315139] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48664e]/35 focus-visible:ring-offset-2";
  const content = (
    <>
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef3ef] text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,.12)] transition-transform group-hover:-translate-x-0.5"
        aria-hidden="true"
      >
        <BackArrowIcon />
      </span>
      <span>{label}</span>
    </>
  );

  return (
    <nav
      aria-label="Page navigation"
      className={`min-h-11 ${className ?? ""}`.trim()}
      data-app-page-navigation=""
    >
      {typeof destination.href === "string" ? (
        <Link href={destination.href} className={controlClassName}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={destination.onClick} className={controlClassName}>
          {content}
        </button>
      )}
    </nav>
  );
}