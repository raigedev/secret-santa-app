"use client";

import Image from "next/image";
import type { ReactNode } from "react";

export type ChatThread = {
  group_id: string;
  group_name: string;
  giver_id: string;
  receiver_id: string;
  other_name: string;
  role: "giver" | "receiver";
  last_message: string;
  last_time: string;
  unread: number;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type AccentTone = "gold" | "sage" | "berry";

export const TONES: Record<AccentTone, { tint: string; text: string; surface: string; bubble: string }> = {
  gold: {
    tint: "bg-[#fcce72]/28",
    text: "text-[#7b5902]",
    surface: "bg-[#fff8eb]",
    bubble: "bg-[linear-gradient(135deg,#7b5902_0%,#a46d0c_100%)] text-[#fff8f1]",
  },
  sage: {
    tint: "bg-[#d7fadb]",
    text: "text-[#43614a]",
    surface: "bg-[#eef8f0]",
    bubble: "bg-[linear-gradient(135deg,#48664e_0%,#3c5a43_100%)] text-[#f7fbf8]",
  },
  berry: {
    tint: "bg-[#ffaba9]/30",
    text: "text-[#75191f]",
    surface: "bg-[#fff1ef]",
    bubble: "bg-[linear-gradient(135deg,#a43c3f_0%,#943034_100%)] text-[#fff7f6]",
  },
};

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f9faf8] px-4 py-5 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(252,206,114,0.32),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(164,60,63,0.16),_transparent_32%),linear-gradient(180deg,_#fbfcfa_0%,_#f2f4f2_100%)]" />
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] bg-cover bg-center opacity-10" />
      <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[#ffaba9]/30 blur-3xl" />
      <div className="absolute bottom-[-9rem] right-[-5rem] h-80 w-80 rounded-full bg-[#d7fadb]/60 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col gap-5">{children}</div>
    </main>
  );
}

export function ArrowLeftIcon() {
  return <span aria-hidden="true" className="text-base leading-none">{"<-"}</span>;
}

export function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 10h11M11 5.5 15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatLineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5.5 6.75C5.5 5.78 6.28 5 7.25 5h9.5c.97 0 1.75.78 1.75 1.75v6.1c0 .97-.78 1.75-1.75 1.75h-5.6L7 18v-3.4h-.75c-.97 0-1.75-.78-1.75-1.75v-6.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 8.7h8M8 11.2h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="5.5" y="10" width="13" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13.4v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function GiftIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4.5" y="9" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 9v10M4.5 12.5h15M12.4 9c2.5 0 3.8-1 3.8-2.4 0-1.2-.8-2.1-2.1-2.1-1.4 0-2.2.9-3.3 2.7L10.7 9h1.7ZM11.6 9c-2.5 0-3.8-1-3.8-2.4 0-1.2.8-2.1 2.1-2.1 1.4 0 2.2.9 3.3 2.7L13.3 9h-1.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function formatMessageTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getThreadTitle(thread: ChatThread): string {
  return thread.role === "giver" ? thread.other_name : "Mystery Santa";
}

function isSelectedThread(thread: ChatThread, activeThread: ChatThread | null): boolean {
  return !!activeThread && thread.group_id === activeThread.group_id && thread.giver_id === activeThread.giver_id && thread.receiver_id === activeThread.receiver_id;
}

function ThreadRolePill({ thread }: { thread: ChatThread }) {
  return thread.role === "giver" ? (
    <span className="inline-flex rounded-full bg-[#fcce72]/28 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b5902]">You are gifting</span>
  ) : (
    <span className="inline-flex rounded-full bg-[#d7fadb] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#43614a]">Your mystery Santa</span>
  );
}

function ThreadCard({
  thread,
  activeThread,
  onOpenThread,
}: {
  thread: ChatThread;
  activeThread: ChatThread | null;
  onOpenThread: (thread: ChatThread) => void;
}) {
  const selected = isSelectedThread(thread, activeThread);

  return (
    <button
      type="button"
      onClick={() => onOpenThread(thread)}
      className={`group w-full rounded-[1.8rem] px-4 py-4 text-left transition ${selected ? "bg-[#fff8eb] shadow-[0_26px_55px_rgba(123,89,2,0.08)]" : "bg-white shadow-[0_18px_35px_rgba(46,52,50,0.04)] hover:-translate-y-0.5"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-[1.25rem] ${thread.role === "giver" ? "bg-[#fcce72]/30 text-[#7b5902]" : "bg-[#d7fadb] text-[#43614a]"}`}>
          {thread.role === "giver" ? <GiftIcon className="h-5 w-5" /> : <LockIcon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <ThreadRolePill thread={thread} />
              <h3 className="mt-3 truncate font-[Plus_Jakarta_Sans] text-lg font-black tracking-[-0.04em] text-[#2e3432]">{getThreadTitle(thread)}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {thread.unread > 0 ? <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#a43c3f] px-2 text-xs font-black text-[#fff7f6]">{thread.unread}</span> : null}
              <span className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${selected ? "text-[#7b5902]" : "text-[#777c7a]"}`}>{thread.last_time || "New"}</span>
            </div>
          </div>
          <p className="mt-1 text-sm text-[#5b605e]">{thread.group_name}</p>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#5b605e]">{thread.last_message}</p>
        </div>
      </div>
    </button>
  );
}

export function ChatRailSection({
  eyebrow,
  title,
  description,
  empty,
  threads,
  activeThread,
  tone,
  onOpenThread,
}: {
  eyebrow: string;
  title: string;
  description: string;
  empty: string;
  threads: ChatThread[];
  activeThread: ChatThread | null;
  tone: AccentTone;
  onOpenThread: (thread: ChatThread) => void;
}) {
  const styles = TONES[tone];

  return (
    <section className="rounded-[2rem] bg-[#ecefec] p-4">
      <div className="rounded-[1.7rem] bg-white/80 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${styles.tint} ${styles.text}`}>{eyebrow}</p>
            <h2 className="mt-3 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">{title}</h2>
          </div>
          <span className={`grid h-10 min-w-10 place-items-center rounded-full text-sm font-black ${styles.surface} ${styles.text}`}>{threads.length}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#5b605e]">{description}</p>
      </div>

      <div className="mt-4 space-y-3">
        {threads.length === 0 ? (
          <div className="rounded-[1.7rem] bg-[#f2f4f2] px-5 py-5 text-sm leading-6 text-[#5b605e]">{empty}</div>
        ) : (
          threads.map((thread) => (
            <ThreadCard key={`${thread.group_id}:${thread.giver_id}:${thread.receiver_id}`} thread={thread} activeThread={activeThread} onOpenThread={onOpenThread} />
          ))
        )}
      </div>
    </section>
  );
}

export function TopHero({
  totalUnread,
  uniqueGroupCount,
  onGoDashboard,
}: {
  totalUnread: number;
  uniqueGroupCount: number;
  onGoDashboard: () => void;
}) {
  return (
    <header className="grid gap-4 rounded-[2.25rem] bg-white/72 p-3 shadow-[0_32px_90px_rgba(46,52,50,0.08)] backdrop-blur-xl lg:grid-cols-[1.15fr_.85fr] lg:p-4">
      <section className="relative overflow-hidden rounded-[1.9rem] bg-[#ecefec] px-6 py-8 sm:px-8 sm:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.72),_transparent_54%),linear-gradient(180deg,_rgba(255,255,255,0.18)_0%,_rgba(236,239,236,0.98)_100%)]" />
        <div className="absolute right-[-2rem] top-8 h-28 w-28 rounded-full bg-[#fcce72]/35 blur-2xl" />
        <div className="relative z-10">
          <button type="button" onClick={onGoDashboard} className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-[#48664e] shadow-[0_16px_32px_rgba(62,92,69,0.08)]">
            <ArrowLeftIcon />
            Dashboard
          </button>
          <div className="mt-6 inline-flex rounded-full bg-[#fcce72]/28 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7b5902]">Private message center</div>
          <h1 className="mt-6 max-w-3xl font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.06em] text-[#2e3432] sm:text-5xl lg:text-[3.3rem] lg:leading-[1.02]">Private gift whispers, without the generic chat-app feel.</h1>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <p className="rounded-[1.6rem] bg-white/80 px-5 py-4 text-[15px] leading-7 text-[#5b605e] shadow-[0_20px_45px_rgba(46,52,50,0.05)]">Ask your recipient careful questions or reply to your mystery Santa in one place. The interface keeps the reveal mechanics in the background and lets the conversation do the work.</p>
            <div className="rounded-[1.6rem] bg-[#fff8eb] px-5 py-4 text-sm leading-6 text-[#5f4500]">
              <p className="font-semibold uppercase tracking-[0.18em]">At a glance</p>
              <p className="mt-3">Unread threads: <strong>{totalUnread}</strong></p>
              <p>Groups with chat access: <strong>{uniqueGroupCount}</strong></p>
            </div>
          </div>
        </div>
      </section>

      <aside className="rounded-[1.9rem] bg-white px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full bg-[#d7fadb] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#43614a]">Privacy rules</div>
            <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">How it stays private</h2>
          </div>
          <Image src="/bells-holly.png" alt="Holiday greenery" width={112} height={112} className="hidden w-20 shrink-0 drop-shadow-[0_18px_30px_rgba(123,89,2,0.16)] sm:block" />
        </div>

        <div className="mt-6 space-y-3">
          <div className="rounded-[1.5rem] bg-[#f2f4f2] px-4 py-4 text-sm leading-6 text-[#43614a]"><strong className="text-[#2e3432]">You to giftee:</strong> ask about sizes, colors, timing, or duplicate items as their Secret Santa.</div>
          <div className="rounded-[1.5rem] bg-[#f2f4f2] px-4 py-4 text-sm leading-6 text-[#43614a]"><strong className="text-[#2e3432]">Santa to you:</strong> reply with preferences without learning who they are.</div>
          <div className="rounded-[1.5rem] bg-[#fff8eb] px-4 py-4 text-sm leading-6 text-[#5f4500]">Each thread is private to that match only. It does not turn into a group chat and it does not expose the reveal early.</div>
        </div>
      </aside>
    </header>
  );
}
