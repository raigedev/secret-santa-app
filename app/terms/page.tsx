import type { Metadata } from "next";

import { LegalPageShell } from "@/app/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Use | My Secret Santa",
  description: "The basic rules for using My Secret Santa to organize gift exchanges.",
};

const SUPPORT_EMAIL = "mysecretsanta.notifications@gmail.com";

const termsSections = [
  {
    title: "Who May Use The App",
    copy: [
      "My Secret Santa is for people organizing gift exchanges with people they know, such as friends, family, classmates, or coworkers.",
      "The app is not directed to children under 13. If a child is involved in a gift exchange, an adult should manage the account and information shared in the app.",
    ],
  },
  {
    title: "Your Account",
    copy: [
      "You are responsible for keeping your sign-in method secure and for the activity that happens from your account.",
      "Use accurate contact information so invitations, reminders, password resets, and important account messages can reach you.",
    ],
  },
  {
    title: "Groups, Wishlists, And Messages",
    copy: [
      "You may create groups, invite people, add wishlist ideas, send private messages, and manage gift progress for your exchanges.",
      "Only add information you have permission to share. Do not use the app to harass people, impersonate someone else, spam invites, or collect sensitive information that is not needed for a gift exchange.",
    ],
  },
  {
    title: "Gift Draws And Privacy",
    copy: [
      "The app is designed to keep Secret Santa assignments private before reveal. Group owners and members should not try to bypass those privacy protections.",
      "A draw can depend on the information group members provide. Please review group members, invite status, dates, and rules before drawing names.",
    ],
  },
  {
    title: "Shopping And Affiliate Links",
    copy: [
      "The app may show shopping options or affiliate links from partners such as Lazada, Shopee, Amazon, or similar stores.",
      "Purchases happen on the store's website or app, not inside My Secret Santa. Store prices, shipping, returns, stock, product quality, and checkout rules are controlled by the store.",
    ],
  },
  {
    title: "AI Suggestions",
    copy: [
      "Some wishlist or shopping idea features may use AI to suggest gift ideas. Treat those suggestions as starting points, not promises that a product is available, appropriate, or the best choice.",
      "Do not enter private details, secrets, passwords, payment information, or information about someone that is not needed for gift planning.",
    ],
  },
  {
    title: "Acceptable Use",
    copy: [
      "Do not attack, scrape, overload, reverse engineer, or abuse the app. Do not attempt to access another user's account, group, wishlist, assignment, private message, report, upload, or affiliate data.",
      "Do not upload malicious files, illegal content, or content that violates someone else's rights.",
    ],
  },
  {
    title: "Availability And Changes",
    copy: [
      "The app may change over time as features are improved, fixed, or removed. Some features may be unavailable during maintenance, provider outages, or abuse prevention work.",
      "We may update these terms when the app changes. Continued use of the app after an update means you accept the updated terms.",
    ],
  },
  {
    title: "Ending Access",
    copy: [
      "You can stop using the app at any time. You may request account deletion through the app or by contacting support.",
      "Access may be limited or removed if an account is used to abuse the service, harm other users, bypass security, or violate these terms.",
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Terms"
      title="Terms of Use"
      description="These are the practical rules for using My Secret Santa. They are written plainly so organizers and members know what is expected."
      lastUpdated="May 26, 2026"
      sections={termsSections}
    >
      <div className="mt-9 rounded-3xl bg-[#fff8ef] p-5 text-sm leading-7 text-[#6f5413]">
        Questions about these terms? Email{" "}
        <a className="font-bold text-[#a43c3f] underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </div>
    </LegalPageShell>
  );
}
