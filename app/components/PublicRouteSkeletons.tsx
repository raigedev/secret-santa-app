import { AuthPageFrame } from "@/app/components/AuthPageShell";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse bg-[#dfe4e1] ${className}`} />;
}

export function AuthRouteSkeleton() {
  return (
    <AuthPageFrame showDecorativeBlobs={false}>
      <section className="rounded-[1.9rem] bg-[#ecefec] px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <SkeletonBlock className="h-8 w-36 rounded-full bg-white/90" />
        <SkeletonBlock className="mt-6 h-12 w-10/12 max-w-xl rounded-2xl" />
        <SkeletonBlock className="mt-3 h-12 w-8/12 max-w-md rounded-2xl" />
        <SkeletonBlock className="mt-5 h-24 w-full max-w-xl rounded-[1.75rem] bg-white/82" />
        <SkeletonBlock className="mt-8 h-44 w-full rounded-4xl bg-white/82" />
      </section>
      <section className="rounded-[1.9rem] bg-white px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <SkeletonBlock className="h-8 w-32 rounded-full bg-[#fcce72]/28" />
        <SkeletonBlock className="mt-5 h-10 w-64 rounded-2xl" />
        <SkeletonBlock className="mt-3 h-5 w-full rounded-full" />
        <SkeletonBlock className="mt-2 h-5 w-9/12 rounded-full" />
        <div className="mt-8 space-y-5">
          <SkeletonBlock className="h-[74px] w-full rounded-3xl" />
          <SkeletonBlock className="h-[74px] w-full rounded-3xl" />
          <SkeletonBlock className="h-14 w-full rounded-full bg-[#a43c3f]/20" />
          <SkeletonBlock className="h-14 w-full rounded-3xl" />
        </div>
      </section>
    </AuthPageFrame>
  );
}

export function LandingRouteSkeleton() {
  return (
    <main className="min-h-screen bg-[#f7f7f2] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-11 w-44 rounded-full" />
          <SkeletonBlock className="h-11 w-32 rounded-full" />
        </div>
        <section className="grid min-h-[calc(100vh-7rem)] items-center gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <SkeletonBlock className="h-9 w-48 rounded-full bg-[#48664e]/15" />
            <SkeletonBlock className="mt-6 h-16 w-full max-w-2xl rounded-3xl" />
            <SkeletonBlock className="mt-3 h-16 w-10/12 max-w-xl rounded-3xl" />
            <SkeletonBlock className="mt-6 h-6 w-full max-w-lg rounded-full" />
            <SkeletonBlock className="mt-2 h-6 w-8/12 max-w-md rounded-full" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SkeletonBlock className="h-14 w-52 rounded-full bg-[#a43c3f]/20" />
              <SkeletonBlock className="h-14 w-44 rounded-full" />
            </div>
          </div>
          <SkeletonBlock className="h-[420px] w-full rounded-4xl bg-white" />
        </section>
      </div>
    </main>
  );
}

export function InviteRouteSkeleton() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef4fb,#f8fbff,#fff7ef)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-4xl bg-white/88 p-6 shadow-[0_28px_80px_rgba(46,52,50,0.1)] sm:p-8">
          <SkeletonBlock className="h-10 w-40 rounded-full" />
          <SkeletonBlock className="mt-7 h-12 w-10/12 rounded-2xl" />
          <SkeletonBlock className="mt-3 h-6 w-8/12 rounded-full" />
          <SkeletonBlock className="mt-8 h-32 w-full rounded-3xl" />
          <SkeletonBlock className="mt-6 h-14 w-full rounded-full bg-[#48664e]/20" />
        </section>
      </div>
    </main>
  );
}

export function ResetPasswordRouteSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9faf8] px-4 py-8">
      <section className="w-full max-w-md rounded-4xl bg-white p-6 shadow-[0_28px_80px_rgba(46,52,50,0.1)]">
        <SkeletonBlock className="h-9 w-44 rounded-2xl" />
        <SkeletonBlock className="mt-3 h-5 w-full rounded-full" />
        <SkeletonBlock className="mt-8 h-[74px] w-full rounded-3xl" />
        <SkeletonBlock className="mt-5 h-14 w-full rounded-full bg-[#a43c3f]/20" />
      </section>
    </main>
  );
}
