"use client";

import Image from "next/image";
import type { KeyboardEventHandler, ReactNode, RefObject } from "react";

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

type OverviewProps = {
  threads: ChatThread[];
  giverThreads: ChatThread[];
  receiverThreads: ChatThread[];
  totalUnread: number;
  uniqueGroupCount: number;
  threadListMessage: string | null;
  onOpenThread: (thread: ChatThread) => void;
  onGoDashboard: () => void;
};

type ActiveThreadProps = {
  activeThread: ChatThread;
  messages: ChatMessage[];
  msgInput: string;
  threadMessage: string | null;
  userId: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onBackToThreads: () => void;
  onMessageInputChange: (value: string) => void;
  onComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onSend: () => void;
};

const TONES: Record<AccentTone, { tint: string; text: string; surface: string; button: string }> = {
  gold: {
    tint: "bg-[#fcce72]/28",
    text: "text-[#7b5902]",
    surface: "bg-[#fff8eb]",
    button: "bg-[linear-gradient(135deg,#a43c3f_0%,#943034_100%)] text-[#fff7f6]",
  },
  sage: {
    tint: "bg-[#d7fadb]",
    text: "text-[#43614a]",
    surface: "bg-[#eef8f0]",
    button: "bg-[linear-gradient(135deg,#48664e_0%,#3c5a43_100%)] text-[#f7fbf8]",
  },
  berry: {
    tint: "bg-[#ffaba9]/30",
    text: "text-[#75191f]",
    surface: "bg-[#fff1ef]",
    button: "bg-[linear-gradient(135deg,#a43c3f_0%,#943034_100%)] text-[#fff7f6]",
  },
};

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f9faf8] px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(252,206,114,0.32),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(164,60,63,0.16),_transparent_32%),linear-gradient(180deg,_#fbfcfa_0%,_#f2f4f2_100%)]" />
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] bg-cover bg-center opacity-10" />
      <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[#ffaba9]/30 blur-3xl" />
      <div className="absolute bottom-[-9rem] right-[-5rem] h-80 w-80 rounded-full bg-[#d7fadb]/60 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-5">{children}</div>
    </main>
  );
}

function ArrowLeftIcon() {
  return <span aria-hidden="true" className="text-base leading-none">{"<-"}</span>;
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 10h11M11 5.5 15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatLineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5.5 6.75C5.5 5.78 6.28 5 7.25 5h9.5c.97 0 1.75.78 1.75 1.75v6.1c0 .97-.78 1.75-1.75 1.75h-5.6L7 18v-3.4h-.75c-.97 0-1.75-.78-1.75-1.75v-6.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 8.7h8M8 11.2h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="5.5" y="10" width="13" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13.4v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GiftIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4.5" y="9" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 9v10M4.5 12.5h15M12.4 9c2.5 0 3.8-1 3.8-2.4 0-1.2-.8-2.1-2.1-2.1-1.4 0-2.2.9-3.3 2.7L10.7 9h1.7ZM11.6 9c-2.5 0-3.8-1-3.8-2.4 0-1.2.8-2.1 2.1-2.1 1.4 0 2.2.9 3.3 2.7L13.3 9h-1.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.6rem] bg-white px-5 py-4 shadow-[0_24px_50px_rgba(46,52,50,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#777c7a]">{label}</p>
      <p className="mt-2 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432]">{value}</p>
    </div>
  );
}

function ThreadRolePill({ thread }: { thread: ChatThread }) {
  if (thread.role === "giver") {
    return <span className="inline-flex rounded-full bg-[#fcce72]/28 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b5902]">Gifting to</span>;
  }

  return <span className="inline-flex rounded-full bg-[#d7fadb] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#43614a]">Your mystery Santa</span>;
}

function ThreadCard({ thread, onOpenThread }: { thread: ChatThread; onOpenThread: (thread: ChatThread) => void }) {
  const title = thread.role === "giver" ? thread.other_name : "Mystery Santa";

  return (
    <button
      type="button"
      onClick={() => onOpenThread(thread)}
      className="group w-full rounded-[1.75rem] bg-white px-4 py-4 text-left shadow-[0_24px_50px_rgba(46,52,50,0.05)] transition hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ThreadRolePill thread={thread} />
          <h3 className="mt-3 truncate font-[Plus_Jakarta_Sans] text-xl font-black tracking-[-0.04em] text-[#2e3432]">{title}</h3>
          <p className="mt-1 text-sm text-[#5b605e]">{thread.group_name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {thread.unread > 0 ? <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#a43c3f] px-2 text-xs font-black text-[#fff7f6]">{thread.unread}</span> : null}
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f2f4f2] text-[#48664e] transition group-hover:translate-x-0.5"><ArrowRightIcon /></span>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#5b605e]">{thread.last_message}</p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#777c7a]">
        <span>{thread.last_time || "New"}</span>
        <span className="text-[#48664e]">Open thread</span>
      </div>
    </button>
  );
}

function ThreadSection({
  eyebrow,
  title,
  description,
  empty,
  threads,
  tone,
  onOpenThread,
}: {
  eyebrow: string;
  title: string;
  description: string;
  empty: string;
  threads: ChatThread[];
  tone: AccentTone;
  onOpenThread: (thread: ChatThread) => void;
}) {
  const styles = TONES[tone];

  return (
    <section className="rounded-[2rem] bg-[#ecefec] p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4 rounded-[1.7rem] bg-white/80 px-4 py-4">
        <div>
          <p className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${styles.tint} ${styles.text}`}>{eyebrow}</p>
          <h2 className="mt-3 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b605e]">{description}</p>
        </div>
        <span className={`grid h-11 min-w-11 place-items-center rounded-full px-3 text-sm font-black ${styles.surface} ${styles.text}`}>{threads.length}</span>
      </div>

      <div className="space-y-3">
        {threads.length === 0 ? (
          <div className="rounded-[1.7rem] bg-[#f2f4f2] px-5 py-5 text-sm leading-6 text-[#5b605e]">{empty}</div>
        ) : (
          threads.map((thread) => (
            <ThreadCard key={`${thread.group_id}:${thread.giver_id}:${thread.receiver_id}`} thread={thread} onOpenThread={onOpenThread} />
          ))
        )}
      </div>
    </section>
  );
}

function formatMessageTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SecretSantaChatOverview({
  threads,
  giverThreads,
  receiverThreads,
  totalUnread,
  uniqueGroupCount,
  threadListMessage,
  onOpenThread,
  onGoDashboard,
}: OverviewProps) {
  return (
    <PageFrame>
      <header className="grid gap-4 rounded-[2.25rem] bg-white/72 p-3 shadow-[0_32px_90px_rgba(46,52,50,0.08)] backdrop-blur-xl lg:grid-cols-[1.1fr_.9fr] lg:p-4">
        <section className="relative overflow-hidden rounded-[1.9rem] bg-[#ecefec] px-6 py-8 sm:px-8 sm:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.72),_transparent_54%),linear-gradient(180deg,_rgba(255,255,255,0.18)_0%,_rgba(236,239,236,0.98)_100%)]" />
          <div className="absolute right-[-2rem] top-8 h-28 w-28 rounded-full bg-[#fcce72]/35 blur-2xl" />
          <div className="relative z-10">
            <button type="button" onClick={onGoDashboard} className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-[#48664e] shadow-[0_16px_32px_rgba(62,92,69,0.08)]">
              <ArrowLeftIcon />
              Dashboard
            </button>
            <div className="mt-6 inline-flex rounded-full bg-[#fcce72]/28 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7b5902]">Private message center</div>
            <h1 className="mt-6 max-w-3xl font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.06em] text-[#2e3432] sm:text-5xl lg:text-[3.3rem] lg:leading-[1.02]">A calmer way to handle Secret Santa questions.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#5b605e] sm:text-lg">Chat privately with the person you are gifting or the anonymous Santa assigned to you. The app keeps identities hidden where it matters, so the screen can focus on useful conversations instead of mystery mechanics.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <StatCard label="Threads" value={threads.length} />
              <StatCard label="Unread" value={totalUnread} />
              <StatCard label="Groups" value={uniqueGroupCount} />
            </div>
          </div>
        </section>

        <aside className="rounded-[1.9rem] bg-white px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-[#d7fadb] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#43614a]">Privacy rules</div>
              <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">Who sees what</h2>
            </div>
            <Image src="/bells-holly.png" alt="Holiday greenery" width={112} height={112} className="hidden w-20 shrink-0 drop-shadow-[0_18px_30px_rgba(123,89,2,0.16)] sm:block" />
          </div>

          <div className="mt-6 space-y-3">
            <div className="rounded-[1.5rem] bg-[#f2f4f2] px-4 py-4 text-sm leading-6 text-[#43614a]"><strong className="text-[#2e3432]">You to giftee:</strong> ask about sizes, colors, timing, or duplicate items as their Secret Santa.</div>
            <div className="rounded-[1.5rem] bg-[#f2f4f2] px-4 py-4 text-sm leading-6 text-[#43614a]"><strong className="text-[#2e3432]">Santa to you:</strong> reply with preferences without learning who they are.</div>
            <div className="rounded-[1.5rem] bg-[#fff8eb] px-4 py-4 text-sm leading-6 text-[#5f4500]">Each thread is private to that match only. It is separate from your group chat and reveal flow.</div>
          </div>
        </aside>
      </header>

      {threadListMessage ? <section className="rounded-[1.7rem] bg-[#fff1ef] px-5 py-4 text-sm font-semibold leading-6 text-[#821a01]">{threadListMessage}</section> : null}

      {threads.length === 0 ? (
        <section className="rounded-[2rem] bg-white px-6 py-12 text-center shadow-[0_32px_90px_rgba(46,52,50,0.06)] sm:px-8">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.5rem] bg-[#f2f4f2] text-[#48664e]"><ChatLineIcon className="h-8 w-8" /></div>
          <h2 className="mt-5 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432]">No private chats yet</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-[#5b605e]">Once a group finishes drawing names, your private Secret Santa conversations appear here automatically. This page will then separate people you are gifting from the anonymous Santa messaging you.</p>
        </section>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          <ThreadSection eyebrow="You gift them" title="People you gift" description="Private threads for asking careful gift questions without exposing your name." empty="No recipient chat yet. Once your group draw is ready, your private recipient thread appears here." threads={giverThreads} tone="gold" onOpenThread={onOpenThread} />
          <ThreadSection eyebrow="They gift you" title="Your mystery Santa" description="Reply to the person assigned to you while their identity stays hidden." empty="No Santa chat yet. Your assigned Santa can start a private thread after the draw." threads={receiverThreads} tone="sage" onOpenThread={onOpenThread} />
        </section>
      )}
    </PageFrame>
  );
}

export function SecretSantaActiveThreadView({
  activeThread,
  messages,
  msgInput,
  threadMessage,
  userId,
  messagesEndRef,
  onBackToThreads,
  onMessageInputChange,
  onComposerKeyDown,
  onSend,
}: ActiveThreadProps) {
  const isGiver = activeThread.role === "giver";
  const tone = isGiver ? "gold" : "sage";
  const ownBubbleTone = isGiver ? "berry" : "sage";
  const title = isGiver ? activeThread.other_name : "Your mystery Santa";
  const privacyCopy = isGiver ? `${activeThread.other_name} only sees this thread as messages from their Secret Santa.` : "You can answer here without seeing who your Santa is.";
  const placeholder = isGiver ? `Ask ${activeThread.other_name} about sizes, colors, or shipping details...` : "Reply with preferences, sizing, or wishlist notes...";
  const remainingCharacters = 500 - msgInput.length;
  const promptHints = isGiver ? ["Ask about fit, size, or color without naming yourself.", "Check what they already own so you avoid duplicates.", "Use short delivery or availability questions when you are ready to buy."] : ["Answer with practical details so your Santa can shop faster.", "Mention materials, scents, or colors you would rather avoid.", "Point them to wishlist priorities if you already added them elsewhere."];

  return (
    <PageFrame>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBackToThreads} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#48664e] shadow-[0_16px_32px_rgba(62,92,69,0.08)]">
          <ArrowLeftIcon />
          Back to chats
        </button>
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#5b605e] shadow-[0_16px_32px_rgba(46,52,50,0.05)]">
          <LockIcon className="h-4 w-4" />
          Private thread
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-[2rem] bg-white p-4 shadow-[0_32px_90px_rgba(46,52,50,0.06)] sm:p-5 lg:p-6">
          <header className="rounded-[1.8rem] bg-[#ecefec] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${TONES[tone].tint} ${TONES[tone].text}`}>{isGiver ? "You are gifting" : "Your mystery Santa"}</div>
                <h1 className="mt-4 truncate font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432] sm:text-[2.2rem]">{title}</h1>
                <p className="mt-2 text-sm font-semibold text-[#5b605e]">{activeThread.group_name}</p>
              </div>
              <div className={`rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${TONES[tone].surface} ${TONES[tone].text}`}>{privacyCopy}</div>
            </div>
          </header>

          <div className="mt-4 rounded-[1.8rem] bg-[#f2f4f2] p-4 sm:p-5">
            <div className="max-h-[52vh] min-h-[45vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[58vh]">
              {threadMessage ? <div className="rounded-[1.4rem] bg-[#fff1ef] px-4 py-3 text-sm font-semibold leading-6 text-[#821a01]">{threadMessage}</div> : null}

              {messages.length === 0 ? (
                <div className="flex min-h-[38vh] flex-col items-center justify-center text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-[1.5rem] bg-white text-[#48664e] shadow-[0_18px_35px_rgba(46,52,50,0.05)]"><ChatLineIcon className="h-8 w-8" /></div>
                  <h2 className="mt-5 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">No messages yet</h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-[#5b605e]">Start with a simple question about size, color, delivery timing, or what they already own.</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.sender_id === userId;
                  const label = isMine ? (isGiver ? "You as Secret Santa" : "You") : (isGiver ? activeThread.other_name : "Secret Santa");

                  return (
                    <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] rounded-[1.75rem] px-4 py-3 shadow-[0_18px_35px_rgba(46,52,50,0.05)] sm:max-w-[72%] ${isMine ? `${TONES[ownBubbleTone].button} rounded-br-md` : "rounded-bl-md bg-white text-[#2e3432]"}`} style={{ opacity: message.id.startsWith("temp-") ? 0.72 : 1 }}>
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${isMine ? "text-white/70" : "text-[#777c7a]"}`}>{label}</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-7">{message.content}</p>
                        <p className={`mt-3 text-[11px] font-semibold ${isMine ? "text-white/70" : "text-[#777c7a]"}`}>{message.id.startsWith("temp-") ? "Sending..." : formatMessageTimestamp(message.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="mt-4 rounded-[1.8rem] bg-[#ecefec] p-3 sm:p-4">
            <textarea value={msgInput} onChange={(event) => onMessageInputChange(event.target.value)} onKeyDown={onComposerKeyDown} placeholder={placeholder} maxLength={500} rows={3} className="min-h-[104px] w-full resize-none rounded-[1.5rem] bg-white px-4 py-3 text-[15px] leading-7 text-[#2e3432] outline outline-1 outline-[#aeb3b1]/30 transition placeholder:text-[#777c7a] focus:outline-[#a43c3f]/35 focus:outline-2" />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[#5b605e]">{remainingCharacters} characters remaining. Press Enter to send, Shift+Enter for a new line.</p>
              <button type="button" onClick={onSend} disabled={!msgInput.trim()} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold shadow-[0_18px_36px_rgba(164,60,63,0.16)] transition disabled:cursor-not-allowed disabled:bg-[#dfe4e1] disabled:text-[#9b9d9c] disabled:shadow-none ${TONES.berry.button}`}>
                Send
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        </div>

        <aside className="grid gap-5 xl:content-start">
          <section className="rounded-[2rem] bg-[#ecefec] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${TONES[tone].tint} ${TONES[tone].text}`}>Identity rules</div>
                <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">How this stays private</h2>
              </div>
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-[1.2rem] ${TONES[tone].surface} ${TONES[tone].text}`}><LockIcon /></div>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-6 text-[#43614a]">
              <div className="rounded-[1.4rem] bg-white px-4 py-4"><strong className="text-[#2e3432]">Thread type:</strong> {isGiver ? "You are writing as Secret Santa to your recipient." : "You are replying to the anonymous Santa assigned to you."}</div>
              <div className="rounded-[1.4rem] bg-white px-4 py-4"><strong className="text-[#2e3432]">Visibility:</strong> Only this match can see the conversation. It does not appear in the group page as a public chat.</div>
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-[0_24px_56px_rgba(46,52,50,0.05)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full bg-[#fcce72]/28 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b5902]">Good prompts</div>
                <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">What to ask next</h2>
              </div>
              <Image src="/bells-holly.png" alt="Holiday greenery" width={104} height={104} className="hidden w-16 shrink-0 sm:block" />
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-[#5b605e]">
              {promptHints.map((hint) => (
                <li key={hint} className="rounded-[1.4rem] bg-[#f2f4f2] px-4 py-4">
                  <div className="flex gap-3">
                    <span className="mt-1 shrink-0 text-[#7b5902]"><GiftIcon className="h-4 w-4" /></span>
                    <span>{hint}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>
    </PageFrame>
  );
}
