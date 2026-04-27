import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | My Secret Santa",
  description:
    "How My Secret Santa handles account, group, wishlist, affiliate, and AI suggestion data.",
};

const policySections = [
  {
    title: "What We Collect",
    copy: [
      "We collect the account details you provide, such as your name, email address, profile settings, and notification choices.",
      "When you use the app, we store group details, invitations, wishlist items, gift assignments, private group messages, gift progress, and activity needed to run the exchange.",
    ],
  },
  {
    title: "How We Use It",
    copy: [
      "We use your data to sign you in, keep your groups private, send invite or reminder messages, show wishlist clues, draw names, and help members manage their gift exchange.",
      "We also keep security and audit records for sensitive actions such as invite handling, report access, rate limits, affiliate events, and account deletion.",
    ],
  },
  {
    title: "Shopping And Affiliate Links",
    copy: [
      "Some shopping links may be affiliate links. When you open one, the app can record the click, the related group or wishlist context, and any conversion details later reported by the affiliate network.",
      "Affiliate reporting is owner-only and is used to understand which links were opened or reported by Lazada. Search-style links do not tell the app which exact product you choose inside Lazada unless Lazada later reports a matching conversion.",
    ],
  },
  {
    title: "AI Suggestions",
    copy: [
      "Wishlist suggestion features may send limited wishlist or gift-preference text to configured AI providers when that feature is enabled.",
      "The app should only send the details needed for the suggestion and should keep provider API keys on the server, never in the browser.",
    ],
  },
  {
    title: "Processors And Storage",
    copy: [
      "The app is built with Vercel for hosting and Supabase for authentication and database storage. It may also use email, AI, and affiliate providers where those features are enabled.",
      "These services process data so the app can run. We do not sell your group, wishlist, or assignment data.",
    ],
  },
  {
    title: "Your Choices",
    copy: [
      "You can update your profile, notification choices, wishlist items, and many group details inside the app.",
      "If you need account deletion or data removal before a self-service flow covers your exact case, contact the app owner through the support channel used for this project.",
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

        <h1 className="mt-5 font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.04em] text-[#26312b] sm:text-5xl">
          Privacy Policy
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-8 text-[#5b605e]">
          This page explains the practical basics of how My Secret Santa handles data. It is
          written for normal users first, and should be reviewed before launch for the countries
          where the app will be offered.
        </p>

        <p className="mt-3 text-sm font-semibold text-[#496d53]">Last updated: April 27, 2026</p>

        <div className="mt-9 space-y-7">
          {policySections.map((section) => (
            <section key={section.title} className="border-t border-[#edf2ee] pt-7">
              <h2 className="font-[Plus_Jakarta_Sans] text-xl font-black tracking-[-0.03em] text-[#26312b]">
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
          This notice is a product and engineering baseline, not legal advice. Before collecting
          real user data at launch, review it against your actual support contact, retention plan,
          region, and any legal requirements that apply to you.
        </div>
      </section>
    </main>
  );
}
