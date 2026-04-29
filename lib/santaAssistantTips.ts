export type SantaAssistantTip = {
  title: string;
  body: string;
  actionLabel?: string;
  href?: string;
};

const DEFAULT_TIPS: SantaAssistantTip[] = [
  {
    title: "Need a hand?",
    body: "Open a group, check your wishlist, or jump into shopping ideas from the sidebar.",
    actionLabel: "Go to dashboard",
    href: "/dashboard",
  },
  {
    title: "Keep the surprise",
    body: "Private messages and assignments are separated so names stay secret until the right moment.",
    actionLabel: "Open messages",
    href: "/secret-santa-chat",
  },
];

const PAGE_TIPS: Array<{
  match: (pathname: string) => boolean;
  tips: SantaAssistantTip[];
}> = [
  {
    match: (pathname) => pathname === "/dashboard",
    tips: [
      {
        title: "Dashboard",
        body: "Create a group, open an existing group, or jump to the part of the exchange you need.",
        actionLabel: "View groups",
        href: "/groups",
      },
      {
        title: "Gift day status",
        body: "Past gift days stay visible for history and follow-up. They do not disappear from your groups.",
      },
    ],
  },
  {
    match: (pathname) => pathname === "/groups" || pathname.startsWith("/group/"),
    tips: [
      {
        title: "Group setup",
        body: "Invite members first, then draw names when everyone has joined.",
      },
      {
        title: "After gift day",
        body: "Keep the group for gift tracking, chat, and records even after the event date passes.",
      },
    ],
  },
  {
    match: (pathname) => pathname === "/my-giftee",
    tips: [
      {
        title: "Your giftee",
        body: "This is the person you are gifting. Keep it private and use their wishlist for ideas.",
        actionLabel: "Open shopping ideas",
        href: "/secret-santa",
      },
    ],
  },
  {
    match: (pathname) => pathname === "/assignments",
    tips: [
      {
        title: "Assignments",
        body: "Use this page to review each match. Shopping and gift progress are kept separate.",
      },
    ],
  },
  {
    match: (pathname) => pathname === "/secret-santa",
    tips: [
      {
        title: "Shopping ideas",
        body: "Pick a wishlist item, then compare gift ideas using that group's budget.",
      },
      {
        title: "Group budget",
        body: "If you have multiple groups, each recipient card follows its own group budget.",
      },
    ],
  },
  {
    match: (pathname) => pathname === "/gift-tracking",
    tips: [
      {
        title: "Gift progress",
        body: "Update your gift progress here. Confirm received gifts only after they arrive.",
      },
    ],
  },
  {
    match: (pathname) => pathname === "/wishlist",
    tips: [
      {
        title: "Wishlist",
        body: "Add clear gift ideas so your Santa has options that actually fit you.",
      },
    ],
  },
  {
    match: (pathname) => pathname === "/secret-santa-chat",
    tips: [
      {
        title: "Private messages",
        body: "Ask gift questions without revealing the surprise. Group chat stays separate.",
      },
    ],
  },
  {
    match: (pathname) => pathname === "/profile",
    tips: [
      {
        title: "Profile",
        body: "Update your photo, festive avatar, and reminder preferences here.",
      },
    ],
  },
];

export function getSantaAssistantTips(pathname: string): SantaAssistantTip[] {
  return PAGE_TIPS.find((entry) => entry.match(pathname))?.tips || DEFAULT_TIPS;
}
