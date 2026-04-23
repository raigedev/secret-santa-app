"use client";

import Image from "next/image";

import { ChatLineIcon, ChatRailSection, type ChatThread, PageFrame, TopHero } from "./chat-ui-shared";

export function SecretSantaChatOverview({
  threads,
  giverThreads,
  receiverThreads,
  totalUnread,
  uniqueGroupCount,
  threadListMessage,
  onOpenThread,
  onGoDashboard,
}: {
  threads: ChatThread[];
  giverThreads: ChatThread[];
  receiverThreads: ChatThread[];
  totalUnread: number;
  uniqueGroupCount: number;
  threadListMessage: string | null;
  onOpenThread: (thread: ChatThread) => void;
  onGoDashboard: () => void;
}) {
  return (
    <PageFrame>
      <TopHero totalUnread={totalUnread} uniqueGroupCount={uniqueGroupCount} onGoDashboard={onGoDashboard} />

      {threadListMessage ? <section className="rounded-[1.7rem] bg-[#fff1ef] px-5 py-4 text-sm font-semibold leading-6 text-[#821a01]">{threadListMessage}</section> : null}

      <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <ChatRailSection eyebrow="You gift them" title="People you gift" description="Private threads for asking careful gift questions without exposing your name." empty="No recipient chat yet. Once your group draw is ready, your private recipient thread appears here." threads={giverThreads} activeThread={null} tone="gold" onOpenThread={onOpenThread} />
          <ChatRailSection eyebrow="They gift you" title="Your mystery Santa" description="Reply to the person assigned to you while their identity stays hidden." empty="No Santa chat yet. Your assigned Santa can start a private thread after the draw." threads={receiverThreads} activeThread={null} tone="sage" onOpenThread={onOpenThread} />
        </div>

        <div className="rounded-[2rem] bg-white p-5 shadow-[0_32px_90px_rgba(46,52,50,0.06)] sm:p-6">
          {threads.length === 0 ? (
            <div className="flex min-h-[48vh] flex-col items-center justify-center text-center">
              <div className="grid h-16 w-16 place-items-center rounded-[1.5rem] bg-[#f2f4f2] text-[#48664e]"><ChatLineIcon className="h-8 w-8" /></div>
              <h2 className="mt-5 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432]">No private chats yet</h2>
              <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-[#5b605e]">Once a group finishes drawing names, your private Secret Santa conversations appear here automatically. This page then separates people you are gifting from the anonymous Santa messaging you.</p>
            </div>
          ) : (
            <div className="grid min-h-[48vh] gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-[1.9rem] bg-[#ecefec] p-5 sm:p-6">
                <div className="rounded-[1.7rem] bg-white px-5 py-5 shadow-[0_24px_56px_rgba(46,52,50,0.05)]">
                  <div className="inline-flex rounded-full bg-[#fcce72]/28 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b5902]">Choose a thread</div>
                  <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-[-0.05em] text-[#2e3432]">Open a conversation to see the full workspace.</h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#5b605e]">The desktop layout keeps your thread rail and active conversation in one calm workspace. On mobile it stacks cleanly, so the inbox and chat view both stay readable.</p>
                </div>

                <div className="mt-5 rounded-[1.8rem] bg-[#f2f4f2] p-5">
                  <div className="rounded-[1.6rem] bg-white px-5 py-5 shadow-[0_20px_45px_rgba(46,52,50,0.05)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#777c7a]">Workspace preview</p>
                    <div className="mt-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex rounded-full bg-[#d7fadb] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#43614a]">Your mystery Santa</div>
                        <h3 className="mt-4 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">Conversation details appear here</h3>
                      </div>
                      <Image src="/bells-holly.png" alt="Holiday greenery" width={104} height={104} className="hidden w-16 shrink-0 sm:block" />
                    </div>
                    <div className="mt-5 space-y-3">
                      <div className="max-w-[82%] rounded-[1.7rem] rounded-bl-md bg-white px-4 py-3 text-sm leading-6 text-[#2e3432] shadow-[0_18px_35px_rgba(46,52,50,0.05)]">Questions, hints, and preferences stay in one private message area.</div>
                      <div className="ml-auto max-w-[75%] rounded-[1.7rem] rounded-br-md bg-[linear-gradient(135deg,#a43c3f_0%,#943034_100%)] px-4 py-3 text-sm leading-6 text-[#fff7f6] shadow-[0_18px_35px_rgba(164,60,63,0.12)]">Open a real thread from the left to see your live conversation and send messages.</div>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="grid gap-5 content-start">
                <div className="rounded-[1.8rem] bg-[#ecefec] p-5">
                  <div className="inline-flex rounded-full bg-[#ffaba9]/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#75191f]">Helpful prompts</div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-[#5b605e]">
                    <li className="rounded-[1.4rem] bg-white px-4 py-4">Ask about fit, color, size, or what they already own.</li>
                    <li className="rounded-[1.4rem] bg-white px-4 py-4">Use the thread for practical clarification, not group-wide chatter.</li>
                    <li className="rounded-[1.4rem] bg-white px-4 py-4">Keep reveal details out of the conversation until the exchange is over.</li>
                  </ul>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </PageFrame>
  );
}
