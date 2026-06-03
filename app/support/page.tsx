import type { Metadata } from "next";

import { LegalPageShell } from "@/app/components/LegalPageShell";
import { getSafeTipJarUrl } from "@/lib/support/tip-jar";

export const metadata: Metadata = {
  title: "Support My Secret Santa | My Secret Santa",
  description: "Optional ways to support the My Secret Santa project.",
};

const SUPPORT_EMAIL = "mysecretsanta.notifications@gmail.com";

const supportSections = [
  {
    title: "Keep The App Free",
    copy: [
      "My Secret Santa is free to start and built to keep gift exchanges simple, private, and calm.",
      "Optional support helps cover hosting, email delivery, maintenance, and the small improvements that make holiday planning easier.",
    ],
  },
  {
    title: "No Paywall",
    copy: [
      "Tips are completely optional. They never change draw results, assignment privacy, feature access, or support priority.",
      "Everyone can keep using the app whether they tip or not.",
    ],
  },
  {
    title: "Secure Payment Page",
    copy: [
      "When the tip jar is available, payments happen on the provider's secure page.",
      "My Secret Santa does not collect card details or payment account details inside the app.",
    ],
  },
] as const;

export default function SupportPage() {
  const tipJarUrl = getSafeTipJarUrl();

  return (
    <LegalPageShell
      eyebrow="Support"
      title="Support My Secret Santa"
      description="If the app saved your group some time, optional support helps keep it running for the next exchange."
      lastUpdated="June 4, 2026"
      sections={supportSections}
    >
      <div className="mt-9 rounded-3xl bg-[#fff8ef] p-5 text-sm leading-7 text-[#6f5413]">
        {tipJarUrl ? (
          <a
            className="inline-flex min-h-11 items-center rounded-full bg-[#a43c3f] px-5 py-3 text-sm font-black text-white no-underline shadow-[0_14px_32px_rgba(164,60,63,0.22)] transition hover:-translate-y-0.5 hover:bg-[#812227]"
            href={tipJarUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the tip jar
          </a>
        ) : (
          <p>
            Want to support the project now? Email{" "}
            <a className="font-bold text-[#a43c3f] underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        )}
      </div>
    </LegalPageShell>
  );
}
