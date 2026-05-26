import type { Metadata } from "next";

import { LegalPageShell } from "@/app/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Affiliate Disclosure | My Secret Santa",
  description:
    "How My Secret Santa uses affiliate shopping links from Amazon, Lazada, Shopee, and similar partners.",
};

const SUPPORT_EMAIL = "mysecretsanta.notifications@gmail.com";

const affiliateDisclosureSections = [
  {
    title: "Short Version",
    copy: [
      "Some shopping links in My Secret Santa are affiliate links. If you buy after opening one, the app owner may earn a commission at no extra cost to you.",
      "You are never required to use an affiliate link. You can search for the same item directly in the store if you prefer.",
    ],
  },
  {
    title: "Shopping Partners",
    copy: [
      "The app may use affiliate links, search links, product links, or campaign links from Amazon, Lazada, Shopee, and similar shopping partners when those programs are configured.",
      "Not every shopping button is guaranteed to be an affiliate link, and not every store visit or purchase will result in commission.",
    ],
  },
  {
    title: "Amazon Associate Disclosure",
    copy: [
      "As an Amazon Associate I earn from qualifying purchases.",
      "Amazon product availability, prices, delivery, returns, and checkout are handled by Amazon, not by My Secret Santa.",
    ],
  },
  {
    title: "What The App May Track",
    copy: [
      "When you open a shopping link, the app may record the click, the merchant, the related group or wishlist context, and technical details needed to protect the service from abuse.",
      "If an affiliate partner later reports a conversion, the app may store the conversion details that partner provides. These reports are used for affiliate reporting and are not meant to reveal private gift choices to other group members.",
    ],
  },
  {
    title: "Store Responsibility",
    copy: [
      "Purchases happen on the store's own website or app. The store is responsible for checkout, payment, shipping, returns, refunds, product quality, and customer support for that purchase.",
      "Before buying, review the store listing, seller, reviews, shipping details, return policy, and final price.",
    ],
  },
  {
    title: "No Extra Cost",
    copy: [
      "Using an affiliate link should not add an extra charge to your order. A commission, when earned, comes from the shopping partner's affiliate program.",
      "Affiliate income may help pay for hosting, email, app maintenance, and future improvements.",
    ],
  },
] as const;

export default function AffiliateDisclosurePage() {
  return (
    <LegalPageShell
      eyebrow="Affiliate"
      title="Affiliate Disclosure"
      description="This page explains how shopping links may support My Secret Santa while keeping the choice to buy fully yours."
      lastUpdated="May 26, 2026"
      sections={affiliateDisclosureSections}
    >
      <div className="mt-9 rounded-3xl bg-[#fff8ef] p-5 text-sm leading-7 text-[#6f5413]">
        Questions about affiliate links? Email{" "}
        <a className="font-bold text-[#a43c3f] underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </div>
    </LegalPageShell>
  );
}
