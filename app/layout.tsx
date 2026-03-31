import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "My Secret Santa",
    template: "%s | My Secret Santa",
  },
  description:
    "Organize Secret Santa groups with invite links, anonymous chat, wishlists, notifications, and live event-day reveal screens.",
  applicationName: "My Secret Santa",
  keywords: [
    "secret santa",
    "gift exchange",
    "wishlist",
    "anonymous chat",
    "christmas party",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
