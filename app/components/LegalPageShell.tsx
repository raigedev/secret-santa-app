import type { ReactNode } from "react";

type LegalPageSection = {
  title: string;
  copy: readonly ReactNode[];
};

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated: string;
  sections: readonly LegalPageSection[];
  children?: ReactNode;
};

export function LegalPageShell({
  eyebrow,
  title,
  description,
  lastUpdated,
  sections,
  children,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-[#f8faf7] px-5 py-10 text-[#2e3432] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl rounded-3xl border border-[#dbe5dc] bg-white px-5 py-8 shadow-[0_28px_80px_rgba(54,79,61,0.12)] sm:px-8 sm:py-10 lg:px-12">
        <div className="inline-flex rounded-full bg-[#e8f1ea] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#496d53]">
          {eyebrow}
        </div>

        <h1 className="mt-5 font-[Plus_Jakarta_Sans] text-4xl font-black tracking-normal text-[#26312b] sm:text-5xl">
          {title}
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-8 text-[#5b605e]">{description}</p>

        <p className="mt-3 text-sm font-semibold text-[#496d53]">Last updated: {lastUpdated}</p>

        <div className="mt-9 space-y-7">
          {sections.map((section) => (
            <section key={section.title} className="border-t border-[#edf2ee] pt-7">
              <h2 className="font-[Plus_Jakarta_Sans] text-xl font-black tracking-normal text-[#26312b]">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-[#5b605e]">
                {section.copy.map((paragraph, index) => (
                  <p key={`${section.title}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {children}
      </section>
    </main>
  );
}
