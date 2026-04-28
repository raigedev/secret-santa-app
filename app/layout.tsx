import type { Metadata } from "next";
import AppRouteShell from "@/app/components/AppRouteShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "My Secret Santa",
    template: "%s | My Secret Santa",
  },
  description:
    "Create Secret Santa groups, invite members, share wishlists, draw names, and keep gift details private.",
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
      <body className="antialiased">
        <AppRouteShell>{children}</AppRouteShell>
      </body>
    </html>
  );
}
