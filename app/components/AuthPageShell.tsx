import Image from "next/image";
import type { ReactNode } from "react";

export type AuthPageMarker = {
  title: string;
  copy: string;
};

export const AUTH_FIELD_CLASS_NAME =
  "mt-2 w-full rounded-3xl bg-[#e5e9e6] px-4 py-3.5 text-[15px] text-[#2e3432] outline outline-1 outline-[#aeb3b1]/30 transition placeholder:text-[#777c7a] focus:bg-white focus:outline-[#a43c3f]/35 focus:outline-2 focus:outline-offset-0 focus:outline";

const AUTH_PAGE_BACKGROUND_IMAGE =
  "radial-gradient(circle at top left, rgba(252,206,114,0.32), transparent 34%), radial-gradient(circle at bottom right, rgba(164,60,63,0.16), transparent 32%), linear-gradient(180deg, #fbfcfa 0%, #f2f4f2 100%)";

const AUTH_HERO_BACKGROUND_IMAGE =
  "radial-gradient(circle at top, rgba(255,255,255,0.72), transparent 54%), linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(236,239,236,0.98) 100%)";

const AUTH_INFO_CARD_BACKGROUND_IMAGE =
  "linear-gradient(180deg, rgba(252,206,114,0.22), transparent)";

const AUTH_PAGE_BACKGROUND_STYLE = { backgroundImage: AUTH_PAGE_BACKGROUND_IMAGE };
const AUTH_HERO_BACKGROUND_STYLE = { backgroundImage: AUTH_HERO_BACKGROUND_IMAGE };
const AUTH_INFO_CARD_BACKGROUND_STYLE = { backgroundImage: AUTH_INFO_CARD_BACKGROUND_IMAGE };

export function AuthPageBackground({
  showDecorativeBlobs = true,
}: {
  showDecorativeBlobs?: boolean;
}) {
  return (
    <>
      <div className="absolute inset-0" style={AUTH_PAGE_BACKGROUND_STYLE} />
      <div className="absolute inset-0 bg-[url('/snowflakes.svg')] bg-size-[320px_320px] bg-repeat opacity-10" />
      {showDecorativeBlobs ? (
        <>
          <div className="absolute -left-32 -top-24 h-72 w-72 rounded-full bg-[#ffaba9]/30 blur-3xl" />
          <div className="absolute -bottom-36 -right-20 h-80 w-80 rounded-full bg-[#d7fadb]/60 blur-3xl" />
        </>
      ) : null}
    </>
  );
}

export function AuthPageFrame({
  children,
  gridClassName = "lg:grid-cols-[1.02fr_0.98fr]",
  showDecorativeBlobs = true,
}: {
  children: ReactNode;
  gridClassName?: string;
  showDecorativeBlobs?: boolean;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f9faf8] px-4 py-6 sm:px-6 lg:px-8">
      <AuthPageBackground showDecorativeBlobs={showDecorativeBlobs} />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <div
          className={`grid w-full gap-4 rounded-[2.25rem] bg-white/72 p-3 shadow-[0_32px_90px_rgba(46,52,50,0.08)] backdrop-blur-xl ${gridClassName} lg:p-4`}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

export function AuthHeroPanel({
  badge,
  title,
  titleAs = "h2",
  titleClassName = "lg:text-[3.3rem]",
  description,
  supportingCopy,
  detailEyebrow,
  detailTitle,
  detailTitleAs = "h3",
  markers,
  imageSize = 160,
  showBottomAccent = false,
}: {
  badge: string;
  title: string;
  titleAs?: "h1" | "h2";
  titleClassName?: string;
  description: string;
  supportingCopy: string;
  detailEyebrow: string;
  detailTitle: string;
  detailTitleAs?: "h2" | "h3";
  markers: readonly AuthPageMarker[];
  imageSize?: number;
  showBottomAccent?: boolean;
}) {
  const Heading = titleAs;
  const DetailHeading = detailTitleAs;

  return (
    <section className="relative overflow-hidden rounded-[1.9rem] bg-[#ecefec] px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <div className="absolute inset-0" style={AUTH_HERO_BACKGROUND_STYLE} />
      <div className="absolute -right-8 top-8 h-28 w-28 rounded-full bg-[#fcce72]/35 blur-2xl" />
      {showBottomAccent ? (
        <div className="absolute bottom-4 left-6 h-24 w-24 rounded-full bg-[#a43c3f]/10 blur-2xl" />
      ) : null}

      <div className="relative z-10 flex h-full flex-col justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7b5902] shadow-[0_16px_32px_rgba(123,89,2,0.08)]">
            {badge}
          </div>
          <Heading
            className={`mt-6 max-w-xl font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.06em] text-[#2e3432] sm:text-5xl ${titleClassName} lg:leading-[1.02]`}
          >
            {title}
          </Heading>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#5b605e] sm:text-lg">
            {description}
          </p>
          <div className="mt-6 rounded-[1.75rem] bg-white/82 p-5 text-sm leading-6 text-[#43614a] shadow-[0_20px_45px_rgba(62,92,69,0.08)]">
            {supportingCopy}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-4xl bg-white/82 p-5 shadow-[0_24px_56px_rgba(46,52,50,0.06)]">
          <div
            className="absolute inset-x-0 top-0 h-24"
            style={AUTH_INFO_CARD_BACKGROUND_STYLE}
          />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="max-w-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b5902]">
                {detailEyebrow}
              </p>
              <DetailHeading className="mt-2 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.05em] text-[#2e3432]">
                {detailTitle}
              </DetailHeading>
            </div>
            <Image
              src="/bells-holly.svg"
              alt="Holiday greenery"
              width={imageSize}
              height={imageSize}
              loading="eager"
              className="hidden w-24 shrink-0 drop-shadow-[0_18px_30px_rgba(123,89,2,0.16)] sm:block"
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {markers.map((marker) => (
              <div key={marker.title} className="rounded-[1.35rem] bg-[#f2f4f2] p-4">
                <p className="text-sm font-semibold text-[#2e3432]">{marker.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#5b605e]">{marker.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
