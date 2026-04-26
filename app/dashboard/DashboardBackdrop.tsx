const SPARKLE_POSITIONS = [
  "left-[8%] top-[12%]",
  "left-[22%] top-[18%]",
  "left-[70%] top-[15%]",
  "left-[84%] top-[24%]",
  "left-[11%] top-[58%]",
  "left-[60%] top-[66%]",
  "left-[88%] top-[72%]",
] as const;

type DashboardBackdropProps = {
  isDarkTheme: boolean;
};

export function DashboardBackdrop({ isDarkTheme }: DashboardBackdropProps) {
  const dashboardOverlayClass = isDarkTheme
    ? "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.20),transparent_24%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.92),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_34%)]"
    : "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,180,255,0.26),transparent_25%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(191,219,254,0.35),transparent_32%)]";
  const sparkleClass = isDarkTheme
    ? "h-2.5 w-2.5 rounded-full bg-sky-200/55 shadow-[0_0_18px_rgba(125,211,252,0.36)]"
    : "h-3 w-3 rounded-full bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.85)]";

  return (
    <>
      <div className={dashboardOverlayClass} />
      <div className="pointer-events-none absolute inset-0 opacity-60">
        {SPARKLE_POSITIONS.map((position) => (
          <span key={position} className={`absolute ${position} ${sparkleClass}`} />
        ))}
      </div>
    </>
  );
}
