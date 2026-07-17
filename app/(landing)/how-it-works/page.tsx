import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works | My Secret Santa",
  description:
    "A start-to-finish guide for creating a Secret Santa group, inviting members, drawing names, shopping, tracking gifts, and reveal day.",
};

const journeySteps = [
  {
    eyebrow: "Start",
    title: "Sign in",
    copy: "Use Google or email to open your private Secret Santa account.",
  },
  {
    eyebrow: "Plan",
    title: "Create a group",
    copy: "Name the exchange, set the gift day, choose the budget, and decide who can join.",
  },
  {
    eyebrow: "Invite",
    title: "Bring everyone in",
    copy: "Send invites and wait for members to join before drawing names.",
  },
  {
    eyebrow: "Wishlists",
    title: "Add gift clues",
    copy: "Members add wishlist ideas so their Santa has useful hints without asking directly.",
  },
  {
    eyebrow: "Draw",
    title: "Draw names",
    copy: "The organizer starts the draw when the group is ready. Everyone only sees their own giftee.",
  },
  {
    eyebrow: "Shop",
    title: "Find the gift",
    copy: "Open shopping ideas, compare options, and use the group budget as a guide.",
  },
  {
    eyebrow: "Message",
    title: "Ask quietly",
    copy: "Use private Secret Santa messages when you need a clue without revealing yourself.",
  },
  {
    eyebrow: "Progress",
    title: "Track the gift",
    copy: "Mark progress as you choose, buy, wrap, or deliver the gift.",
  },
  {
    eyebrow: "Reveal",
    title: "Enjoy reveal day",
    copy: "Exchange gifts, reveal who picked each name, and keep the memory in your history.",
  },
] as const;

const demoChapters = [
  ["0:00", "Create the exchange"],
  ["0:35", "Invite the group"],
  ["1:05", "Collect wishlists"],
  ["1:35", "Draw names"],
  ["2:05", "Shop and message"],
  ["2:45", "Track progress"],
  ["3:15", "Reveal and remember"],
] as const;

const organizerTasks = [
  "Create the group and set the budget.",
  "Invite members and watch who has joined.",
  "Start the draw when everyone is ready.",
  "Send gentle reminders when wishlists or gifts need attention.",
  "Run reveal day without exposing matches early.",
] as const;

const participantTasks = [
  "Accept the invite and confirm your profile.",
  "Add wishlist clues your Santa can actually use.",
  "Check your giftee after names are drawn.",
  "Use shopping ideas and private messages to choose well.",
  "Update gift progress so the exchange stays on track.",
] as const;

function MiniAppPreview() {
  return (
    <div className="relative overflow-hidden rounded-4xl bg-[#fffefa] p-4 shadow-[0_30px_80px_rgba(72,102,78,0.16)] ring-1 ring-[#eadbd1] sm:p-5">
      <div className="rounded-3xl bg-[#f6f1e9] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[#a43c3f]">
              Demo video
            </div>
            <div className="mt-2 font-[var(--font-landing-display)] text-2xl font-black text-[#2e3432]">
              Secret Santa from start to finish
            </div>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#a43c3f] text-xl font-black text-white shadow-[0_16px_38px_rgba(164,60,63,0.3)]">
            Play
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_0.8fr]">
          <div className="rounded-3xl bg-white p-4 shadow-[0_12px_34px_rgba(46,52,50,0.08)]">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-[#f7dedc]" />
              <div>
                <div className="h-3 w-28 rounded-full bg-[#48664e]" />
                <div className="mt-2 h-2 w-40 rounded-full bg-[#d9dad8]" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="h-20 rounded-2xl bg-[#ffe7c2]" />
              <div className="h-20 rounded-2xl bg-[#dfeee0]" />
              <div className="h-20 rounded-2xl bg-[#f2cbc9]" />
            </div>
          </div>

          <div className="rounded-3xl bg-[#48664e] p-4 text-white shadow-[0_18px_42px_rgba(72,102,78,0.24)]">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[#d7fadb]">
              Reveal ready
            </div>
            <div className="mt-3 h-3 w-24 rounded-full bg-white/80" />
            <div className="mt-3 h-2 w-32 rounded-full bg-white/40" />
            <div className="mt-5 rounded-full bg-white px-4 py-2 text-center text-sm font-black text-[#48664e]">
              Open giftee
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-full bg-white px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[#84252a]">
            Wishlist
          </div>
          <div className="rounded-full bg-white px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[#48664e]">
            Shopping
          </div>
          <div className="rounded-full bg-white px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[#7b5902]">
            Reveal
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-[#f9faf8] text-[#2e3432]">
      <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:px-12 lg:pb-24 lg:pt-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_12%,rgba(252,206,114,0.20),transparent_25%),radial-gradient(circle_at_92%_8%,rgba(164,60,63,0.10),transparent_26%),linear-gradient(180deg,#fffefa_0%,#f8f0e4_52%,#f9faf8_100%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-black text-[#48664e] shadow-[0_12px_28px_rgba(46,52,50,0.07)] transition hover:-translate-y-0.5 hover:text-[#a43c3f]"
            >
              Back to home
            </Link>
            <p className="mt-10 text-xs font-black uppercase tracking-[0.2em] text-[#a43c3f]">
              Start-to-finish guide
            </p>
            <h1 className="mt-4 max-w-3xl font-[var(--font-landing-serif)] text-5xl font-black leading-tight text-[#1f2422] sm:text-6xl">
              How My Secret Santa works.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5b605e]">
              Create an exchange, invite your people, collect wishlists, draw names, and
              keep gift progress organized without spoiling the secret.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center rounded-full bg-[#a43c3f] px-7 text-base font-black text-white shadow-[0_16px_38px_rgba(164,60,63,0.26)] transition hover:-translate-y-0.5 hover:bg-[#812227]"
              >
                Create a group
              </Link>
              <a
                href="#demo-script"
                className="inline-flex min-h-12 items-center rounded-full bg-white px-7 text-base font-black text-[#48664e] shadow-[0_12px_28px_rgba(46,52,50,0.07)] ring-1 ring-[#e5d8ce] transition hover:-translate-y-0.5 hover:text-[#a43c3f]"
              >
                View demo outline
              </a>
            </div>
          </div>

          <MiniAppPreview />
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a43c3f]">
              The journey
            </p>
            <h2 className="mt-3 font-[var(--font-landing-serif)] text-4xl font-black text-[#1f2422]">
              One exchange, nine clear moments.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#5b605e]">
              The app separates organizer tasks from participant tasks so everyone knows
              what to do next.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {journeySteps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-3xl bg-white p-5 shadow-[0_12px_34px_rgba(46,52,50,0.06)] ring-1 ring-[#edf0ea]"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full bg-[#f5ebe7] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#84252a]">
                    {step.eyebrow}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#48664e] font-black text-white">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-[var(--font-landing-display)] text-xl font-black text-[#2e3432]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5b605e]">{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#f3f0ea] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
          <div className="rounded-4xl bg-white p-7 shadow-[0_18px_48px_rgba(46,52,50,0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a43c3f]">
              Organizer
            </p>
            <h2 className="mt-3 font-[var(--font-landing-serif)] text-3xl font-black text-[#1f2422]">
              What the organizer does
            </h2>
            <ul className="mt-6 space-y-3">
              {organizerTasks.map((task) => (
                <li key={task} className="rounded-2xl bg-[#fbf8f2] px-4 py-3 text-sm font-bold text-[#44504b]">
                  {task}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-4xl bg-[#48664e] p-7 text-white shadow-[0_18px_48px_rgba(72,102,78,0.18)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d7fadb]">
              Participant
            </p>
            <h2 className="mt-3 font-[var(--font-landing-serif)] text-3xl font-black">
              What each member does
            </h2>
            <ul className="mt-6 space-y-3">
              {participantTasks.map((task) => (
                <li key={task} className="rounded-2xl bg-white/12 px-4 py-3 text-sm font-bold text-white">
                  {task}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="demo-script" className="px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a43c3f]">
              Demo video outline
            </p>
            <h2 className="mt-3 font-[var(--font-landing-serif)] text-4xl font-black text-[#1f2422]">
              The walkthrough should feel like a holiday checklist, not a software tutorial.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#5b605e]">
              A polished demo can be about three minutes long, with short captions,
              clean demo data, and no real email addresses or private group details on screen.
            </p>
          </div>

          <div className="rounded-4xl bg-white p-5 shadow-[0_18px_48px_rgba(46,52,50,0.08)] ring-1 ring-[#edf0ea]">
            <div className="space-y-3">
              {demoChapters.map(([time, title]) => (
                <div
                  key={time}
                  className="grid grid-cols-[72px_1fr] items-center gap-4 rounded-2xl bg-[#fbf8f2] px-4 py-3"
                >
                  <span className="rounded-full bg-white px-3 py-2 text-center text-xs font-black text-[#a43c3f] shadow-[0_8px_20px_rgba(46,52,50,0.05)]">
                    {time}
                  </span>
                  <span className="font-[var(--font-landing-display)] text-base font-black text-[#2e3432]">
                    {title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl rounded-4xl bg-[#a43c3f] px-6 py-12 text-center text-white shadow-[0_26px_70px_rgba(164,60,63,0.26)] sm:px-10">
          <h2 className="font-[var(--font-landing-serif)] text-4xl font-black">
            Ready to start your exchange?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/80">
            Start with a group, add your members, and let the app keep the secret safe until reveal day.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center rounded-full bg-white px-8 text-base font-black text-[#a43c3f] shadow-[0_16px_38px_rgba(46,52,50,0.18)] transition hover:-translate-y-0.5"
            >
              Create your group
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
