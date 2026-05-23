import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | My Secret Santa",
  description:
    "How My Secret Santa handles account, group, wishlist, affiliate, and AI suggestion data.",
};

const SUPPORT_EMAIL = "mysecretsanta.notifications@gmail.com";

const policySections = [
  {
    title: "Who This Is For",
    copy: [
      "My Secret Santa helps adults organize gift exchanges with people they know, such as friends, family, classmates, or coworkers.",
      "The app is not directed to children under 13. Please do not use it to collect information from children without appropriate parent or guardian involvement.",
    ],
  },
  {
    title: "What We Collect",
    copy: [
      "We collect the account details you provide, such as your name, email address, profile settings, avatar, notification choices, and sign-in details from Google or email authentication.",
      "When you use the app, we store group details, invitations, wishlist items, gift assignments, private group messages, gift progress, reminders, notifications, and activity needed to run the exchange.",
      "We use cookies and limited browser storage to keep you signed in, remember safe app preferences, and restore recent page state. We do not use these tools to sell your personal data.",
    ],
  },
  {
    title: "How We Use It",
    copy: [
      "We use your data to sign you in, keep your groups private, send invite or reminder messages, show wishlist clues, draw names, and help members manage their gift exchange.",
      "We also keep security and audit records for sensitive actions such as invite handling, report access, rate limits, affiliate events, account deletion, and suspicious activity.",
    ],
  },
  {
    title: "Shopping And Affiliate Links",
    copy: [
      "Some shopping buttons and links may be affiliate links. If you buy after opening one, My Secret Santa may earn a commission at no extra cost to you.",
      "When you open a shopping link, the app can record the click, the related group or wishlist context, and any conversion details later reported by the affiliate network.",
      "Affiliate reporting is owner-only and is used to understand which shopping links were opened or later reported by a shopping partner such as Lazada, Shopee, or Amazon. Search-style links do not tell the app which exact product you choose inside the store unless the partner later reports a matching conversion.",
      "Once you leave My Secret Santa for a store such as Lazada, Shopee, or Amazon, that store's own privacy policy and checkout rules apply.",
      "As an Amazon Associate I earn from qualifying purchases.",
    ],
  },
  {
    title: "AI Suggestions",
    copy: [
      "Wishlist suggestion features may send limited wishlist or gift-preference text to configured AI providers when that feature is enabled.",
      "The app sends only the details needed for the suggestion, excludes private item notes from provider prompts, and keeps provider API keys on the server, never in the browser.",
    ],
  },
  {
    title: "Emails And Notifications",
    copy: [
      "We may send transactional emails such as account confirmation, password reset, welcome, invite, and reminder messages.",
      "You can update many notification choices in your profile. Transactional or security messages may still be sent when needed to run the app safely.",
    ],
  },
  {
    title: "Service Providers And Storage",
    copy: [
      "The app is built with Vercel for hosting and Supabase for authentication and database storage. It may also use Google sign-in, email delivery, AI, and affiliate providers where those features are enabled.",
      "These services process data so the app can run. We do not sell your group, wishlist, assignment, message, or profile data.",
    ],
  },
  {
    title: "Your Choices",
    copy: [
      "You can update your profile, notification choices, wishlist items, and many group details inside the app.",
      "You can request account deletion from your profile. Deletion removes your account and linked personal records where the app can safely remove them, but some security, audit, or affiliate records may be retained when needed to protect the service, prevent abuse, or satisfy reporting obligations.",
      `For privacy, deletion, or security requests, contact ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    title: "Security",
    copy: [
      "The app uses managed authentication, server-side authorization checks, Row Level Security, rate limits, and restrictive security headers to reduce common risks.",
      "No system is perfect. Report suspected security or privacy issues to the app owner so they can be investigated quickly.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8faf7] px-5 py-10 text-[#2e3432] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl rounded-3xl border border-[#dbe5dc] bg-white px-5 py-8 shadow-[0_28px_80px_rgba(54,79,61,0.12)] sm:px-8 sm:py-10 lg:px-12">
        <div className="inline-flex rounded-full bg-[#e8f1ea] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#496d53]">
          Privacy
        </div>

        <h1 className="mt-5 font-[Plus_Jakarta_Sans] text-4xl font-black tracking-normal text-[#26312b] sm:text-5xl">
          Privacy Policy
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-8 text-[#5b605e]">
          This page explains the practical basics of how My Secret Santa handles data. It is
          written for people using the app and will be updated when the app changes.
        </p>

        <p className="mt-3 text-sm font-semibold text-[#496d53]">Last updated: May 23, 2026</p>

        <div className="mt-9 space-y-7">
          {policySections.map((section) => (
            <section key={section.title} className="border-t border-[#edf2ee] pt-7">
              <h2 className="font-[Plus_Jakarta_Sans] text-xl font-black tracking-normal text-[#26312b]">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-[#5b605e]">
                {section.copy.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-9 rounded-3xl bg-[#fff8ef] p-5 text-sm leading-7 text-[#6f5413]">
          Questions about privacy, deletion, or security? Email{" "}
          <a className="font-bold text-[#a43c3f] underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </div>
      </section>
    </main>
  );
}
