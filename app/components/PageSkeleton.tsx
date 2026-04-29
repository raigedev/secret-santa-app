"use client";

// ═══════════════════════════════════════
// SKELETON LOADING COMPONENTS
// ═══════════════════════════════════════
// Shimmer placeholders that match each page layout.
// Shown instantly while data loads.
// ═══════════════════════════════════════

function Bone({ w, h, r = 8, className = "" }: { w: string; h: string; r?: number; className?: string }) {
  return (
    <div className={className} style={{
      width: w, maxWidth: "100%", height: h, borderRadius: r,
      background:
        "linear-gradient(90deg,rgba(72,102,78,.12) 25%,rgba(255,255,255,.92) 50%,rgba(252,206,114,.18) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

const shimmerCSS = `@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}`;
const appShellBackground =
  "repeating-linear-gradient(135deg,rgba(72,102,78,.045) 0 1px,transparent 1px 38px),radial-gradient(circle at 12% 8%,rgba(252,206,114,.16),transparent 24%),linear-gradient(180deg,#fffefa 0%,#f7faf5 42%,#eef4ef 100%)";
const panelSurface = "linear-gradient(135deg,rgba(255,255,255,.92),rgba(251,252,250,.84))";
const quietBorder = "1px solid rgba(72,102,78,.14)";

// ─── Dashboard Skeleton ───
export function DashboardSkeleton() {
  return (
    <main data-testid="dashboard-loading-shell" className="min-h-screen" style={{ background: appShellBackground }}>
      <style>{shimmerCSS}</style>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-end gap-3">
          <Bone w="140px" h="42px" r={999} />
          <Bone w="126px" h="42px" r={999} />
          <Bone w="118px" h="42px" r={999} />
        </div>

        <div className="mb-10 flex flex-col items-center">
          <Bone w="180px" h="38px" r={999} />
          <Bone w="340px" h="42px" className="mt-4" />
          <Bone w="250px" h="16px" className="mt-3" />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.95fr_0.95fr]">
          <Bone w="100%" h="360px" r={32} />
          <Bone w="100%" h="280px" r={32} />
          <Bone w="100%" h="280px" r={32} />
        </div>

        <div className="mt-10">
          <Bone w="170px" h="18px" className="mb-3" />
          <Bone w="240px" h="34px" className="mb-5" />
          <Bone w="100%" h="240px" r={32} className="mb-5" />
          <Bone w="100%" h="240px" r={32} />
        </div>

        <div className="mt-10">
          <Bone w="180px" h="18px" className="mb-3" />
          <Bone w="240px" h="34px" className="mb-5" />
          <Bone w="100%" h="220px" r={32} />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Bone w="100%" h="220px" r={30} />
          <Bone w="100%" h="220px" r={30} />
        </div>
      </div>
    </main>
  );
}

// ─── Group Page Skeleton ───
export function GroupSkeleton() {
  return (
    <main data-testid="group-loading-shell" className="min-h-screen" style={{ background: appShellBackground }}>
      <style>{shimmerCSS}</style>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Bone w="100px" h="32px" className="mb-5" />
        <div className="rounded-[28px] p-8 shadow-[0_18px_46px_rgba(46,52,50,.06)]" style={{ background: panelSurface, border: quietBorder }}>
          <div className="flex flex-col items-center">
            <Bone w="200px" h="32px" />
            <Bone w="140px" h="16px" className="mt-3" />
            <Bone w="260px" h="44px" r={14} className="mt-4" />
          </div>
        </div>
        <div className="mt-6"><Bone w="120px" h="20px" /></div>
        <div className="flex gap-2 mt-3">
          <Bone w="80px" h="32px" r={16} />
          <Bone w="80px" h="32px" r={16} />
          <Bone w="80px" h="32px" r={16} />
        </div>
      </div>
    </main>
  );
}

// ─── Chat Skeleton ───
export function ChatSkeleton() {
  return (
    <main data-testid="chat-loading-shell" className="min-h-screen" style={{ background: appShellBackground }}>
      <style>{shimmerCSS}</style>
      <div className="max-w-[720px] mx-auto px-4 py-6">
        <Bone w="100px" h="32px" />
        <div className="flex flex-col items-center mt-5 mb-6">
          <Bone w="240px" h="28px" />
          <Bone w="180px" h="14px" className="mt-2" />
        </div>
        <div className="flex gap-3 mb-6">
          <Bone w="100%" h="80px" r={16} />
          <Bone w="100%" h="80px" r={16} />
        </div>
        <Bone w="180px" h="20px" />
        <Bone w="100%" h="64px" r={16} className="mt-3" />
        <Bone w="100%" h="64px" r={16} className="mt-2" />
        <Bone w="160px" h="20px" className="mt-5" />
        <Bone w="100%" h="64px" r={16} className="mt-3" />
      </div>
    </main>
  );
}

// ─── Profile Skeleton ───
export function ProfileSkeleton() {
  return (
    <main data-testid="profile-loading-shell" className="min-h-screen" style={{ background: appShellBackground }}>
      <style>{shimmerCSS}</style>
      <div className="max-w-[640px] mx-auto px-4 py-6">
        <Bone w="100px" h="32px" className="mb-5" />
        <div className="flex flex-col items-center mb-8">
          <Bone w="180px" h="26px" />
          <Bone w="220px" h="14px" className="mt-2" />
        </div>
        {/* Avatar section */}
        <div className="rounded-[20px] p-7 mb-4" style={{ background: "#fff" }}>
          <div className="flex flex-col items-center">
            <Bone w="100px" h="100px" r={50} />
            <Bone w="120px" h="14px" className="mt-3" />
            <Bone w="160px" h="12px" className="mt-2" />
          </div>
          <div className="grid grid-cols-8 gap-2 mt-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Bone key={i} w="100%" h="0" r={50} className="aspect-square" />
            ))}
          </div>
        </div>
        {/* Form sections */}
        <div className="rounded-[20px] p-7 mb-4" style={{ background: "#fff" }}>
          <Bone w="120px" h="20px" className="mb-4" />
          <Bone w="100%" h="44px" r={12} className="mb-3" />
          <Bone w="100%" h="44px" r={12} className="mb-3" />
          <Bone w="100%" h="70px" r={12} />
        </div>
        <div className="rounded-[20px] p-7 mb-4" style={{ background: "#fff" }}>
          <Bone w="120px" h="20px" className="mb-4" />
          <div className="flex gap-2">
            <Bone w="60px" h="36px" r={10} />
            <Bone w="60px" h="36px" r={10} />
            <Bone w="60px" h="36px" r={10} />
            <Bone w="60px" h="36px" r={10} />
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Secret Santa Page Skeleton ───
export function SecretSantaSkeleton() {
  return (
    <main data-testid="secret-santa-loading-shell" className="min-h-screen" style={{ background: appShellBackground }}>
      <style>{shimmerCSS}</style>
      <aside
        className="fixed inset-y-0 left-0 z-10 hidden w-[17.5rem] border-r px-5 py-5 xl:block"
        style={{
          background:
            "repeating-linear-gradient(135deg,rgba(72,102,78,.045) 0 1px,transparent 1px 38px),linear-gradient(180deg,rgba(255,254,250,.985),rgba(247,250,245,.965))",
          borderColor: "rgba(72,102,78,.16)",
        }}
      >
        <div className="flex items-center gap-3">
          <Bone w="48px" h="48px" r={17} />
          <div className="min-w-0 flex-1">
            <Bone w="150px" h="24px" />
            <Bone w="90px" h="10px" className="mt-2" />
          </div>
        </div>
        <div className="mt-10 space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Bone key={index} w="100%" h="42px" r={14} />
          ))}
        </div>
      </aside>
      <div className="relative z-20 min-h-screen xl:pl-[17.5rem]">
        <header className="hidden h-[84px] items-center justify-between border-b px-7 xl:flex" style={{ background: "rgba(255,254,250,.92)", borderColor: "rgba(72,102,78,.14)" }}>
          <div>
            <Bone w="180px" h="18px" />
            <Bone w="220px" h="12px" className="mt-2" />
          </div>
          <div className="flex items-center gap-3">
            <Bone w="126px" h="44px" r={999} />
            <Bone w="48px" h="48px" r={999} />
            <Bone w="160px" h="56px" r={999} />
          </div>
        </header>
        <div className="mx-auto w-full max-w-[94rem] px-4 py-4 sm:px-6 sm:py-6 xl:px-7 xl:py-6">
          <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
            <div>
              <Bone w="260px" h="52px" r={18} />
              <Bone w="420px" h="18px" r={10} className="mt-4 max-w-full" />
              <Bone w="260px" h="14px" r={10} className="mt-3 max-w-full" />
            </div>
            <div className="rounded-[22px] p-4 shadow-[0_18px_42px_rgba(46,52,50,.06)]" style={{ background: panelSurface, border: quietBorder }}>
              <Bone w="110px" h="14px" />
              <Bone w="180px" h="30px" className="mt-3" />
              <Bone w="160px" h="12px" className="mt-2" />
            </div>
          </div>
          <div className="rounded-[28px] p-5 shadow-[0_18px_42px_rgba(46,52,50,.06)]" style={{ background: panelSurface, border: quietBorder }}>
            <Bone w="190px" h="22px" />
            <Bone w="460px" h="14px" className="mt-3 max-w-full" />
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Bone w="100%" h="110px" r={20} />
              <Bone w="100%" h="110px" r={20} />
              <Bone w="100%" h="110px" r={20} />
            </div>
          </div>
          <div className="mt-5 rounded-[28px] p-5 shadow-[0_18px_42px_rgba(46,52,50,.05)]" style={{ background: panelSurface, border: quietBorder }}>
            <Bone w="230px" h="24px" />
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <Bone w="100%" h="260px" r={24} />
              <Bone w="100%" h="260px" r={24} />
              <Bone w="100%" h="260px" r={24} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function NotificationsSkeleton() {
  return (
    <main data-testid="notifications-loading-shell" className="min-h-screen" style={{ background: appShellBackground }}>
      <style>{shimmerCSS}</style>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Bone w="120px" h="32px" r={999} className="mb-6" />
        <Bone w="220px" h="34px" className="mb-3" />
        <Bone w="280px" h="16px" className="mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Bone key={index} w="100%" h="116px" r={28} />
          ))}
        </div>
      </div>
    </main>
  );
}

export function CreateGroupSkeleton() {
  return (
    <main data-testid="create-group-loading-shell" className="min-h-screen" style={{ background: appShellBackground }}>
      <style>{shimmerCSS}</style>
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg rounded-[24px] bg-white/80 p-8 shadow-[0_24px_70px_rgba(148,163,184,0.18)] backdrop-blur-md">
          <Bone w="120px" h="32px" r={999} className="mb-6" />
          <Bone w="220px" h="34px" className="mb-3" />
          <Bone w="260px" h="16px" className="mb-8" />
          <div className="space-y-4">
            <Bone w="100%" h="48px" r={14} />
            <Bone w="100%" h="96px" r={14} />
            <Bone w="100%" h="48px" r={14} />
            <Bone w="100%" h="48px" r={14} />
            <Bone w="100%" h="84px" r={14} />
            <Bone w="100%" h="48px" r={14} />
          </div>
        </div>
      </div>
    </main>
  );
}
