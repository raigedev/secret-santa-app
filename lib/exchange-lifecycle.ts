const DAY_MS = 24 * 60 * 60 * 1000;

const GIFT_PANIC_WINDOW_DAYS = 2;

type ExchangeLifecycleStepId =
  | "setup"
  | "invites"
  | "wishlists"
  | "draw"
  | "shopping"
  | "giftDay"
  | "history";

type ExchangeLifecycleStatus = "done" | "current" | "locked" | "attention";

type ExchangeLifecycleStep = {
  id: ExchangeLifecycleStepId;
  label: string;
  helper: string;
  status: ExchangeLifecycleStatus;
};

type ExchangeNextAction = {
  href: string;
  label: string;
  tone: "evergreen" | "red" | "neutral";
};

type ExchangeLifecycleInput = {
  acceptedCount: number;
  eventDate: string | null | undefined;
  giftProgressTotal: number;
  hasDrawn: boolean;
  isOwner: boolean;
  memberCount: number;
  pendingInviteCount: number;
  readyGiftCount: number;
  recipientCount: number;
  wishlistItemCount: number;
};

type ExchangeLifecycleSummary = {
  daysUntilEvent: number | null;
  isGiftDayPast: boolean;
  isGiftDayToday: boolean;
  isPanicWindow: boolean;
  nextAction: ExchangeNextAction;
  readinessPercent: number;
  steps: ExchangeLifecycleStep[];
};

function parseEventDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const [datePart] = value.split("T");
  const [yearPart, monthPart, dayPart] = datePart.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    yearPart.length !== 4 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed.getTime();
}

function getCalendarDayKey(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getExchangeDaysUntilEvent(
  eventDate: string | null | undefined,
  now: number | Date = Date.now()
): number | null {
  const eventTime = parseEventDate(eventDate);

  if (eventTime === null) {
    return null;
  }

  const nowTime = now instanceof Date ? now.getTime() : now;

  return Math.round((getCalendarDayKey(eventTime) - getCalendarDayKey(nowTime)) / DAY_MS);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value), 0), 100);
}

function getStepStatus(
  isDone: boolean,
  isCurrent: boolean,
  isAttention: boolean,
  isUnlocked: boolean
): ExchangeLifecycleStatus {
  if (isDone) {
    return "done";
  }

  if (isAttention) {
    return "attention";
  }

  if (isCurrent) {
    return "current";
  }

  return isUnlocked ? "current" : "locked";
}

function getNextAction(
  input: ExchangeLifecycleInput,
  daysUntilEvent: number | null,
  isPanicWindow: boolean
): ExchangeNextAction {
  if (input.memberCount === 0) {
    return { href: "/create-group", label: "Create an exchange", tone: "evergreen" };
  }

  if (input.isOwner && (input.acceptedCount < 2 || input.pendingInviteCount > 0)) {
    return { href: "/groups", label: "Review invites", tone: "evergreen" };
  }

  if (input.wishlistItemCount === 0) {
    return { href: "/wishlist", label: "Add wishlist ideas", tone: "evergreen" };
  }

  if (input.isOwner && !input.hasDrawn) {
    return { href: "/groups", label: "Open draw controls", tone: "evergreen" };
  }

  if (isPanicWindow && input.recipientCount > 0) {
    return { href: "/secret-santa", label: "Review gift ideas", tone: "red" };
  }

  if (input.recipientCount > 0 && input.readyGiftCount < input.giftProgressTotal) {
    return { href: "/gift-tracking", label: "Update gift progress", tone: "evergreen" };
  }

  if (daysUntilEvent !== null && daysUntilEvent < 0) {
    return { href: "/history", label: "Open history", tone: "neutral" };
  }

  return { href: "/secret-santa", label: "Open shopping ideas", tone: "evergreen" };
}

export function buildExchangeLifecycleSummary(
  input: ExchangeLifecycleInput,
  now: number | Date = Date.now()
): ExchangeLifecycleSummary {
  const daysUntilEvent = getExchangeDaysUntilEvent(input.eventDate, now);
  const isGiftDayToday = daysUntilEvent === 0;
  const isGiftDayPast = typeof daysUntilEvent === "number" && daysUntilEvent < 0;
  const isPanicWindow =
    typeof daysUntilEvent === "number" &&
    daysUntilEvent >= 0 &&
    daysUntilEvent <= GIFT_PANIC_WINDOW_DAYS &&
    input.recipientCount > 0 &&
    input.readyGiftCount < Math.max(input.giftProgressTotal, 1);
  const hasUsefulWishlist = input.wishlistItemCount > 0;
  const hasInviteBase = input.acceptedCount >= 2 || input.memberCount >= 2;
  const shoppingDone =
    input.giftProgressTotal > 0 && input.readyGiftCount >= input.giftProgressTotal;
  const readinessParts = [
    input.eventDate ? 1 : 0,
    hasInviteBase ? 1 : 0,
    hasUsefulWishlist ? 1 : 0,
    input.hasDrawn ? 1 : 0,
    input.recipientCount > 0 ? 1 : 0,
    shoppingDone ? 1 : 0,
  ];
  const readinessPercent = clampPercent(
    (readinessParts.reduce((sum, value) => sum + value, 0) / readinessParts.length) * 100
  );

  const steps: ExchangeLifecycleStep[] = [
    {
      helper: input.eventDate ? "Date and budget are set." : "Choose the gift day and budget.",
      id: "setup",
      label: "Setup",
      status: getStepStatus(Boolean(input.eventDate), false, false, true),
    },
    {
      helper:
        input.pendingInviteCount > 0
          ? `${input.pendingInviteCount} invite${input.pendingInviteCount === 1 ? "" : "s"} waiting.`
          : `${input.acceptedCount || input.memberCount} member${
              (input.acceptedCount || input.memberCount) === 1 ? "" : "s"
            } ready.`,
      id: "invites",
      label: "Invites",
      status: getStepStatus(
        hasInviteBase && input.pendingInviteCount === 0,
        Boolean(input.eventDate) && !hasInviteBase,
        Boolean(input.eventDate) && input.pendingInviteCount > 0,
        Boolean(input.eventDate)
      ),
    },
    {
      helper: hasUsefulWishlist
        ? `${input.wishlistItemCount} wishlist idea${
            input.wishlistItemCount === 1 ? "" : "s"
          } visible.`
        : "Ask members to add a few ideas.",
      id: "wishlists",
      label: "Wishlists",
      status: getStepStatus(hasUsefulWishlist, hasInviteBase, hasInviteBase && !hasUsefulWishlist, hasInviteBase),
    },
    {
      helper: input.hasDrawn ? "Names have been drawn." : "Draw names after members are ready.",
      id: "draw",
      label: "Draw",
      status: getStepStatus(input.hasDrawn, hasUsefulWishlist, false, hasUsefulWishlist),
    },
    {
      helper:
        input.recipientCount > 0
          ? `${input.recipientCount} recipient${input.recipientCount === 1 ? "" : "s"} assigned.`
          : "Shopping ideas appear after the draw.",
      id: "shopping",
      label: "Shop",
      status: getStepStatus(input.recipientCount > 0 && shoppingDone, input.hasDrawn, isPanicWindow, input.hasDrawn),
    },
    {
      helper: isGiftDayToday
        ? "Gift day is today."
        : isGiftDayPast
          ? "Gift day has passed."
          : daysUntilEvent === null
            ? "Waiting for a date."
            : `${daysUntilEvent} day${daysUntilEvent === 1 ? "" : "s"} left.`,
      id: "giftDay",
      label: "Gift day",
      status: getStepStatus(isGiftDayPast, isGiftDayToday, isPanicWindow, input.hasDrawn),
    },
    {
      helper: isGiftDayPast ? "Wrap-up will move it into history." : "Past exchanges live here.",
      id: "history",
      label: "History",
      status: isGiftDayPast ? "current" : "locked",
    },
  ];

  return {
    daysUntilEvent,
    isGiftDayPast,
    isGiftDayToday,
    isPanicWindow,
    nextAction: getNextAction(input, daysUntilEvent, isPanicWindow),
    readinessPercent,
    steps,
  };
}
