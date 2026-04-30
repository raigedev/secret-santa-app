import type { ReactNode } from "react";

type DashboardActionCardProps = {
  accent: "rose" | "green" | "blue";
  title: string;
  description: string;
  isDarkTheme: boolean;
  onClick: () => void;
  icon: ReactNode;
};

export function DashboardActionCard({
  accent,
  title,
  description,
  isDarkTheme,
  onClick,
  icon,
}: DashboardActionCardProps) {
  const theme =
    accent === "rose"
      ? {
          surface: isDarkTheme
            ? "bg-[linear-gradient(135deg,#4b1524,#2a0f18)] text-rose-50"
            : "bg-[linear-gradient(135deg,#ffaaa7,#f67f83)] text-[#7f000c]",
          icon: isDarkTheme ? "text-rose-100" : "text-[#7f000c]",
          chip: "Gift match",
          glow: "bg-rose-200/20",
          ring: isDarkTheme ? "ring-rose-100/20" : "ring-rose-100/60",
        }
      : accent === "green"
        ? {
            surface: isDarkTheme
              ? "bg-[linear-gradient(135deg,#173f25,#0f2a18)] text-emerald-50"
              : "bg-[linear-gradient(135deg,#b3f7a6,#81df8c)] text-[#065f18]",
            icon: isDarkTheme ? "text-emerald-100" : "text-[#065f18]",
            chip: "Private clues",
            glow: "bg-emerald-200/20",
            ring: isDarkTheme ? "ring-emerald-100/20" : "ring-emerald-100/60",
          }
        : {
            surface: isDarkTheme
              ? "bg-[linear-gradient(135deg,#164569,#0d2d48)] text-sky-50"
              : "bg-[linear-gradient(135deg,#76bfff,#4aa4f6)] text-[#003a5c]",
            icon: isDarkTheme ? "text-sky-100" : "text-[#003a5c]",
            chip: "Plan an event",
            glow: "bg-sky-200/20",
            ring: isDarkTheme ? "ring-sky-100/20" : "ring-sky-100/60",
          };

  const artwork =
    accent === "rose" ? (
      <svg
        aria-hidden="true"
        className="absolute -bottom-10 -right-6 h-44 w-44 text-white/[0.20] transition duration-300 group-hover:scale-105"
        viewBox="0 0 180 180"
        fill="none"
      >
        <path d="M35 78h110v70H35V78Z" stroke="currentColor" strokeWidth="10" />
        <path d="M25 56h130v32H25V56Z" stroke="currentColor" strokeWidth="10" />
        <path d="M90 56v92M54 56c-19-22 13-38 36 0M126 56c19-22-13-38-36 0" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        <path d="M48 118h84" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray="12 14" />
      </svg>
    ) : accent === "green" ? (
      <svg
        aria-hidden="true"
        className="absolute -right-9 top-3 h-48 w-48 text-white/[0.18] transition duration-300 group-hover:translate-x-1"
        viewBox="0 0 190 190"
        fill="none"
      >
        <path d="M31 54c0-18 15-33 33-33h64c18 0 33 15 33 33v33c0 18-15 33-33 33H84l-35 30v-32c-11-6-18-18-18-31V54Z" stroke="currentColor" strokeWidth="9" />
        <path d="M61 68h72M61 88h45" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
        <circle cx="59" cy="137" r="7" fill="currentColor" />
        <circle cx="82" cy="137" r="7" fill="currentColor" />
        <circle cx="105" cy="137" r="7" fill="currentColor" />
      </svg>
    ) : (
      <svg
        aria-hidden="true"
        className="absolute -bottom-8 -right-5 h-48 w-48 text-white/[0.20] transition duration-300 group-hover:rotate-3"
        viewBox="0 0 190 190"
        fill="none"
      >
        <path d="M52 50h84c13 0 24 11 24 24v62c0 13-11 24-24 24H52c-13 0-24-11-24-24V74c0-13 11-24 24-24Z" stroke="currentColor" strokeWidth="9" />
        <path d="M28 84h132M68 34v32M120 34v32" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
        <path d="M94 103v34M77 120h34" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
        <circle cx="56" cy="116" r="6" fill="currentColor" />
        <circle cx="132" cy="116" r="6" fill="currentColor" />
      </svg>
    );

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative isolate min-h-41.5 overflow-hidden rounded-4xl p-7 text-left shadow-[0_10px_26px_rgba(45,51,55,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(45,51,55,0.10)] active:scale-[0.99] ${theme.surface}`}
    >
      <span
        aria-hidden="true"
        className={`absolute -left-16 -top-16 h-40 w-40 rounded-full blur-2xl ${theme.glow}`}
      />
      <span aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-white/30" />
      {artwork}
      <div className="relative z-10 flex min-h-29.5 flex-col justify-between">
        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div
              className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.12] ring-1 ${theme.ring} ${theme.icon}`}
            >
              {icon}
            </div>
            <span className="rounded-full bg-white/[0.12] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white/75">
              {theme.chip}
            </span>
          </div>
          <h2 className="text-[1.55rem] font-black leading-tight tracking-tight">{title}</h2>
        </div>
        <p className="mt-3 max-w-68 text-[15px] font-semibold leading-6 opacity-[0.82]">
          {description}
        </p>
      </div>
    </button>
  );
}
