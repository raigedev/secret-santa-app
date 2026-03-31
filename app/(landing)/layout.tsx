import { Fredoka, Nunito, Playfair_Display } from "next/font/google";

const landingBodyFont = Nunito({
  subsets: ["latin"],
  variable: "--font-landing-body",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const landingDisplayFont = Fredoka({
  subsets: ["latin"],
  variable: "--font-landing-display",
  weight: ["400", "500", "600", "700"],
});

const landingSerifFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-landing-serif",
  weight: ["700", "800", "900"],
});

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${landingBodyFont.variable} ${landingDisplayFont.variable} ${landingSerifFont.variable}`}
    >
      {children}
    </div>
  );
}
