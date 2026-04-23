"use client";

import Image from "next/image";
import type { KeyboardEventHandler, RefObject } from "react";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChatRailSection,
  LockIcon,
  PageFrame,
  TONES,
  formatMessageTimestamp,
  getThreadTitle,
  type ChatMessage,
  type ChatThread,
} from "./chat-ui-shared";

export function SecretSantaActiveThreadView({
  threads,
  giverThreads,
  receiverThreads,
  activeThread,
  messages,
  msgInput,
  threadMessage,
  userId,
  messagesEndRef,
  onBackToThreads,
  onOpenThread,
  onMessageInputChange,
  onComposerKeyDown,
  onSend,
}: {
  threads: ChatThread[];
  giverThreads: ChatThread[];
  receiverThreads: ChatThread[];
  activeThread: ChatThread;
  messages: ChatMessage[];
  msgInput: string;
  threadMessage: string | null;
  userId: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onBackToThreads: () => void;
  onOpenThread: (thread: ChatThread) => void;
  onMessageInputChange: (value: string) => void;
  onComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onSend: () => void;
}) {
  const isGiver = activeThread.role === "giver";
  const threadTone = isGiver ? TONES.gold : TONES.sage;
  const ownBubble = isGiver ? TONES.berry.bubble : TONES.sage.bubble;
  const title = getThreadTitle(activeThread);
  const privacyCopy = isGiver ? `${activeThread.other_name} only sees this as a message from their Secret Santa.` : "Your identity remains hidden until the reveal date.";
  const placeholder = isGiver ? `Ask ${activeThread.other_name} about sizes, colors, or shipping details...` : "Reply with preferences, sizing, or wishlist notes...";
  const remainingCharacters = 500 - msgInput.length;
  const promptHints = isGiver ? ["Ask about fit, size, or color without naming yourself.", "Check what they already own so you avoid duplicates.", "Use the thread for quick delivery or availability questions."] : ["Answer with practical details so your Santa can shop faster.", "Mention materials, scents, or colors you would rather avoid.", "Point them to your wishlist priorities if you already added them elsewhere."];

  return (
    <PageFrame>
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button type="button" onClick={onBackToThreads} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#48664e] shadow-[0_16px_32px_rgba(62,92,69,0.08)]">
          <ArrowLeftIcon />
          Back to chats
        </button>
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#5b605e] shadow-[0_16px_32px_rgba(46,52,50,0.05)]">
          <LockIcon className="h-4 w-4" />
          Private thread
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="hidden space-y-5 xl:block">
          <div className="rounded-[2rem] bg-[#ecefec] p-5">
            <div className="flex items-start justify-between gap-4 rounded-[1.7rem] bg-white px-4 py-4">
              <div>
                <div className="inline-flex rounded-full bg-[#fcce72]/28 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b5902]">Conversation rail</div>
                <h2 className="mt-3 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">Private chats</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b605e]">{threads.length} active threads ready to open.</p>
              </div>
              <button type="button" onClick={onBackToThreads} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f4f2] text-[#48664e]">
                <ArrowLeftIcon />
              </button>
            </div>
          </div>

          <ChatRailSection eyebrow="You gift them" title="People you gift" description="Recipient threads stay together here so you can move between chats quickly." empty="No recipient chat yet." threads={giverThreads} activeThread={activeThread} tone="gold" onOpenThread={onOpenThread} />
          <ChatRailSection eyebrow="They gift you" title="Your mystery Santa" description="Reply to the anonymous Santa assigned to you without leaving the main workspace." empty="No Santa chat yet." threads={receiverThreads} activeThread={activeThread} tone="sage" onOpenThread={onOpenThread} />
        </aside>

        <div className="rounded-[2rem] bg-white p-4 shadow-[0_32px_90px_rgba(46,52,50,0.06)] sm:p-5 lg:p-6">
          <header className="rounded-[1.8rem] bg-[#ecefec] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${threadTone.tint} ${threadTone.text}`}>{isGiver ? "You are gifting" : "Your mystery Santa"}</div>
                <h1 className="mt-4 truncate font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432] sm:text-[2.2rem]">{title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#5b605e]">
                  <span className="rounded-full bg-white px-3 py-1 font-semibold">{activeThread.group_name}</span>
                  <span className={`rounded-full px-3 py-1 font-semibold ${threadTone.surface} ${threadTone.text}`}>{isGiver ? "Recipient thread" : "Santa thread"}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:max-w-sm">
                <div className={`rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${threadTone.surface} ${threadTone.text}`}>{privacyCopy}</div>
                <div className="hidden items-center justify-between rounded-[1.5rem] bg-white px-4 py-3 text-sm text-[#5b605e] shadow-[0_18px_35px_rgba(46,52,50,0.04)] lg:flex">
                  <span>Current thread</span>
                  <span className="font-semibold text-[#2e3432]">{title}</span>
                </div>
              </div>
            </div>
          </header>

          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-[1.8rem] bg-[#f2f4f2] p-4 sm:p-5">
              <div className="max-h-[54vh] min-h-[46vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[58vh]">
                {threadMessage ? <div className="rounded-[1.4rem] bg-[#fff1ef] px-4 py-3 text-sm font-semibold leading-6 text-[#821a01]">{threadMessage}</div> : null}

                {messages.length === 0 ? (
                  <div className="flex min-h-[38vh] flex-col items-center justify-center text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-[1.5rem] bg-white text-[#48664e] shadow-[0_18px_35px_rgba(46,52,50,0.05)]"><LockIcon className="h-8 w-8" /></div>
                    <h2 className="mt-5 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">No messages yet</h2>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-[#5b605e]">Start with a simple question about size, color, delivery timing, or what they already own.</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.sender_id === userId;
                    const label = isMine ? (isGiver ? "You as Secret Santa" : "You") : (isGiver ? activeThread.other_name : "Secret Santa");

                    return (
                      <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[88%] rounded-[1.75rem] px-4 py-3 shadow-[0_18px_35px_rgba(46,52,50,0.05)] sm:max-w-[74%] ${isMine ? `${ownBubble} rounded-br-md` : "rounded-bl-md bg-white text-[#2e3432]"}`} style={{ opacity: message.id.startsWith("temp-") ? 0.72 : 1 }}>
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

            <aside className="grid gap-5 content-start">
              <section className="rounded-[1.8rem] bg-[#ecefec] p-5">
                <div className="inline-flex rounded-full bg-[#d7fadb] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#43614a]">Identity rules</div>
                <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">Stay useful, stay anonymous</h2>
                <div className="mt-4 space-y-3 text-sm leading-6 text-[#43614a]">
                  <div className="rounded-[1.4rem] bg-white px-4 py-4"><strong className="text-[#2e3432]">Thread type:</strong> {isGiver ? "You are writing as Secret Santa to your recipient." : "You are replying to the anonymous Santa assigned to you."}</div>
                  <div className="rounded-[1.4rem] bg-white px-4 py-4"><strong className="text-[#2e3432]">Visibility:</strong> Only this match can see the conversation. It does not appear as public group chat.</div>
                </div>
              </section>

              <section className="rounded-[1.8rem] bg-white p-5 shadow-[0_24px_56px_rgba(46,52,50,0.05)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex rounded-full bg-[#fcce72]/28 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b5902]">Prompt ideas</div>
                    <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">What to ask next</h2>
                  </div>
                  <Image src="/bells-holly.png" alt="Holiday greenery" width={104} height={104} className="hidden w-16 shrink-0 sm:block" />
                </div>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-[#5b605e]">
                  {promptHints.map((hint) => (
                    <li key={hint} className="rounded-[1.4rem] bg-[#f2f4f2] px-4 py-4">{hint}</li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>

          <div className="mt-4 rounded-[1.8rem] bg-[#ecefec] p-3 sm:p-4">
            <div className="rounded-[1.6rem] bg-white p-3 shadow-[0_20px_45px_rgba(46,52,50,0.05)]">
              <textarea value={msgInput} onChange={(event) => onMessageInputChange(event.target.value)} onKeyDown={onComposerKeyDown} placeholder={placeholder} maxLength={500} rows={3} className="min-h-[110px] w-full resize-none rounded-[1.5rem] bg-[#f2f4f2] px-4 py-3 text-[15px] leading-7 text-[#2e3432] outline outline-1 outline-[#aeb3b1]/25 transition placeholder:text-[#777c7a] focus:bg-white focus:outline-[#a43c3f]/35 focus:outline-2" />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[#5b605e]">{remainingCharacters} characters remaining. Press Enter to send, Shift+Enter for a new line.</p>
                <button type="button" onClick={onSend} disabled={!msgInput.trim()} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold shadow-[0_18px_36px_rgba(164,60,63,0.16)] transition disabled:cursor-not-allowed disabled:bg-[#dfe4e1] disabled:text-[#9b9d9c] disabled:shadow-none ${TONES.berry.bubble}`}>
                  Send
                  <ArrowRightIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
