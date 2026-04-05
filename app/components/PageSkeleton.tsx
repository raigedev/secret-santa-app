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
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

const shimmerCSS = `@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}`;

// ─── Dashboard Skeleton ───
export function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#edf6ff_0%,#f8fbff_45%,#eef5ff_100%)]">
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
    <main className="min-h-screen" style={{ background: "linear-gradient(180deg,#0a1628,#162d50,#0a1628)" }}>
      <style>{shimmerCSS}</style>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Bone w="100px" h="32px" className="mb-5" />
        <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
          <div className="flex flex-col items-center">
            <div style={{ opacity: .15 }}><Bone w="200px" h="32px" /></div>
            <div style={{ opacity: .1 }} className="mt-3"><Bone w="140px" h="16px" /></div>
            <div style={{ opacity: .1 }} className="mt-4"><Bone w="260px" h="44px" r={12} /></div>
          </div>
        </div>
        <div style={{ opacity: .15 }} className="mt-6"><Bone w="120px" h="20px" /></div>
        <div className="flex gap-2 mt-3">
          <div style={{ opacity: .1 }}><Bone w="80px" h="32px" r={16} /></div>
          <div style={{ opacity: .1 }}><Bone w="80px" h="32px" r={16} /></div>
          <div style={{ opacity: .1 }}><Bone w="80px" h="32px" r={16} /></div>
        </div>
      </div>
    </main>
  );
}

// ─── Chat Skeleton ───
export function ChatSkeleton() {
  return (
    <main className="min-h-screen" style={{ background: "linear-gradient(180deg,#0a1628,#162d50,#0a1628)" }}>
      <style>{shimmerCSS}</style>
      <div className="max-w-[720px] mx-auto px-4 py-6">
        <div style={{ opacity: .2 }}><Bone w="100px" h="32px" /></div>
        <div className="flex flex-col items-center mt-5 mb-6">
          <div style={{ opacity: .15 }}><Bone w="240px" h="28px" /></div>
          <div style={{ opacity: .1 }} className="mt-2"><Bone w="180px" h="14px" /></div>
        </div>
        <div className="flex gap-3 mb-6">
          <div style={{ opacity: .08 }}><Bone w="100%" h="80px" r={12} /></div>
          <div style={{ opacity: .08 }}><Bone w="100%" h="80px" r={12} /></div>
        </div>
        <div style={{ opacity: .12 }}><Bone w="180px" h="20px" /></div>
        <div style={{ opacity: .06 }} className="mt-3"><Bone w="100%" h="64px" r={12} /></div>
        <div style={{ opacity: .06 }} className="mt-2"><Bone w="100%" h="64px" r={12} /></div>
        <div style={{ opacity: .12 }} className="mt-5"><Bone w="160px" h="20px" /></div>
        <div style={{ opacity: .06 }} className="mt-3"><Bone w="100%" h="64px" r={12} /></div>
      </div>
    </main>
  );
}

// ─── Profile Skeleton ───
export function ProfileSkeleton() {
  return (
    <main className="min-h-screen" style={{ background: "linear-gradient(180deg,#eef4fb,#dce8f5,#e8dce0)" }}>
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
    <main className="min-h-screen" style={{ background: "linear-gradient(180deg,#0a1628,#162d50,#0a1628)" }}>
      <style>{shimmerCSS}</style>
      <div className="max-w-[720px] mx-auto px-4 py-6">
        <div style={{ opacity: .2 }}><Bone w="100px" h="32px" /></div>
        <div className="flex flex-col items-center mt-5 mb-6">
          <div style={{ opacity: .15 }}><Bone w="260px" h="32px" /></div>
          <div style={{ opacity: .1 }} className="mt-2"><Bone w="200px" h="14px" /></div>
        </div>
        <div style={{ opacity: .08 }} className="mb-4"><Bone w="100%" h="160px" r={16} /></div>
        <div style={{ opacity: .08 }} className="mb-4"><Bone w="100%" h="160px" r={16} /></div>
        <div style={{ opacity: .12 }} className="mt-5"><Bone w="140px" h="22px" /></div>
        <div style={{ opacity: .08 }} className="mt-3"><Bone w="100%" h="200px" r={16} /></div>
      </div>
    </main>
  );
}

export function NotificationsSkeleton() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#edf6ff_0%,#f8fbff_45%,#eef5ff_100%)]">
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef4fb,#dce8f5,#e8dce0)]">
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
