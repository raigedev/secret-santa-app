"use client";

export type AppNavIcon =
  | "dashboard"
  | "group"
  | "giftee"
  | "wishlist"
  | "messages"
  | "report"
  | "shopping"
  | "tracking"
  | "reminders";

type AppShellIconProps = {
  className?: string;
  name: AppNavIcon;
};

export function AppShellIcon({ name, className = "h-5 w-5" }: AppShellIconProps) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;

  if (name === "dashboard") {
    return <svg {...common}><path d="M4 5h6v6H4V5Zm10 0h6v6h-6V5ZM4 15h6v4H4v-4Zm10 0h6v4h-6v-4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
  }

  if (name === "group") {
    return <svg {...common}><path d="M8.4 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.2 0a2.7 2.7 0 1 0 0-5.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /><path d="M3.8 19c.8-3.1 2.9-4.9 5.4-4.9s4.6 1.8 5.4 4.9M14.8 14.4c2.5.3 4.2 1.9 5 4.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
  }

  if (name === "giftee") {
    return <svg {...common}><path d="M12 12a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM5.6 20c1-3.2 3.4-5 6.4-5s5.4 1.8 6.4 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
  }

  if (name === "wishlist") {
    return <svg {...common}><path d="M12 20s-7.2-4.5-8.5-9.2C2.6 7.5 4.6 5 7.6 5c1.8 0 3.1 1 4.4 2.5C13.3 6 14.6 5 16.4 5c3 0 5 2.5 4.1 5.8C19.2 15.5 12 20 12 20Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
  }

  if (name === "messages") {
    return <svg {...common}><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-5 4V6.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
  }

  if (name === "shopping") {
    return <svg {...common}><path d="M6.5 9.5h11l-.7 10h-9.6l-.7-10Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /><path d="M9 9.5a3 3 0 0 1 6 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /><path d="M9 5.5h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
  }

  if (name === "report") {
    return <svg {...common}><path d="M5 19V5h14v14H5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /><path d="M8.5 15.5v-4M12 15.5V8.5M15.5 15.5v-5.2M8.5 7.5h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
  }

  if (name === "tracking") {
    return <svg {...common}><path d="M4 8h11v9H4V8Zm11 3h2.8l2.2 2.4V17h-5v-6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /><circle cx="8" cy="18" r="1.7" stroke="currentColor" strokeWidth="1.7" /><circle cx="17" cy="18" r="1.7" stroke="currentColor" strokeWidth="1.7" /></svg>;
  }

  return <svg {...common}><path d="M12 6v6l3.6 2.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /><path d="M5.3 5.7 3.8 4.2M18.7 5.7l1.5-1.5M12 3a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
}
