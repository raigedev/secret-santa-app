export type SantaAssistantTip = {
  title: string;
  body: string;
  actionLabel?: string;
  href?: string;
};

export type SantaAssistantAnswer = {
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
    body: "My Giftee shows who you are gifting. Keep that name private until the exchange.",
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
    match: (pathname) => pathname === "/secret-santa",
    tips: [
      {
        title: "Shopping ideas",
        body: "Pick a wishlist item, then find gift ideas that fit that group's budget.",
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
        body: "Update your photo, festive avatar, and account details here.",
      },
    ],
  },
  {
    match: (pathname) => pathname === "/reminders",
    tips: [
      {
        title: "Reminders",
        body: "Choose which gift nudges you receive and how they arrive.",
      },
      {
        title: "Quiet workspace",
        body: "You can hide Santa Buddy here whenever you want a calmer screen.",
      },
    ],
  },
];

export function getSantaAssistantTips(pathname: string): SantaAssistantTip[] {
  return PAGE_TIPS.find((entry) => entry.match(pathname))?.tips || DEFAULT_TIPS;
}

export function getSantaAssistantAnswer(
  question: string,
  pathname: string
): SantaAssistantAnswer {
  const normalizedQuestion = question.trim().toLowerCase();
  const pageTip = getSantaAssistantTips(pathname)[0];

  if (!normalizedQuestion) {
    return {
      title: "Ask me anything here",
      body: pageTip.body,
      actionLabel: pageTip.actionLabel,
      href: pageTip.href,
    };
  }

  if (normalizedQuestion.includes("budget") || normalizedQuestion.includes("price")) {
    return {
      title: "Group budget",
      body: "Use the group budget as your spending guide. If you have more than one group, each giftee card follows its own group budget.",
      actionLabel: "Open shopping ideas",
      href: "/secret-santa",
    };
  }

  if (
    normalizedQuestion.includes("giftee") ||
    normalizedQuestion.includes("recipient") ||
    normalizedQuestion.includes("assignment") ||
    normalizedQuestion.includes("match")
  ) {
    return {
      title: "Your giftee",
      body: "My Giftee is the place to see who you are gifting. Keep that page for recipient details, wishlist clues, and gift ideas.",
      actionLabel: "Open My Giftee",
      href: "/my-giftee",
    };
  }

  if (
    normalizedQuestion.includes("gift track") ||
    normalizedQuestion.includes("progress") ||
    normalizedQuestion.includes("received") ||
    normalizedQuestion.includes("sent")
  ) {
    return {
      title: "Gift tracking",
      body: "Use Gift Tracking to update your gift progress. A gift should only be confirmed after it actually arrives.",
      actionLabel: "Open Gift Tracking",
      href: "/gift-tracking",
    };
  }

  if (
    normalizedQuestion.includes("wishlist") ||
    normalizedQuestion.includes("idea") ||
    normalizedQuestion.includes("shopping")
  ) {
    return {
      title: "Gift ideas",
      body: "Add wishlist ideas for your own Santa, and use Shopping Ideas when you are choosing a gift for your giftee.",
      actionLabel: "Open shopping ideas",
      href: "/secret-santa",
    };
  }

  if (
    normalizedQuestion.includes("hide") ||
    normalizedQuestion.includes("assistant") ||
    normalizedQuestion.includes("santa buddy")
  ) {
    return {
      title: "Santa Buddy",
      body: "Open Reminders to hide or show the floating assistant. Your choice stays saved on this browser.",
      actionLabel: "Open reminders",
      href: "/reminders",
    };
  }

  if (
    normalizedQuestion.includes("group") ||
    normalizedQuestion.includes("invite") ||
    normalizedQuestion.includes("draw")
  ) {
    return {
      title: "Group setup",
      body: "Open My Groups to manage members, invites, wishlists, and the name draw for each exchange.",
      actionLabel: "Open My Groups",
      href: "/groups",
    };
  }

  return {
    title: "Santa Buddy tip",
    body: pageTip.body,
    actionLabel: pageTip.actionLabel,
    href: pageTip.href,
  };
}
