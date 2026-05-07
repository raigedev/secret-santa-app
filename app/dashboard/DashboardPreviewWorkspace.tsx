"use client";
import { buildExchangeLifecycleSummary } from "@/lib/exchange-lifecycle";
import { DashboardCommandDesk } from "./DashboardCommandDesk";
import type { DashboardActivityItem, GiftProgressSummary, Group, PendingInvite } from "./dashboard-types";
type DashboardPreviewWorkspaceProps = {
  activityFeedItems: DashboardActivityItem[];
  countdownNow: number;
  displayFirstName: string;
  giftProgressSummary: GiftProgressSummary | null;
  groups: Group[];
  hasAssignments: boolean;
  isDarkTheme: boolean;
  pendingInvites: PendingInvite[];
  recipientCount: number;
  revealMessage: string;
  unreadNotificationCount: number;
  wishlistItemCount: number;
  onCreateGroup: () => void;
  onOpenChat: () => void;
  onOpenGiftProgress: () => void;
  onOpenGroup: (groupId: string) => void;
  onOpenGroups: () => void;
  onOpenPath: (path: string) => void;
  onOpenSecretSanta: () => void;
  onOpenWishlist: () => void;
};

function getGroupEventTime(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getFocusGroup(groups: Group[]): Group | null {
  return [...groups].sort(
    (left, right) => getGroupEventTime(left.event_date) - getGroupEventTime(right.event_date)
  )[0] || null;
}

function getPercent(value: number, total: number): number {
  return total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100));
}

export function DashboardPreviewWorkspace({
  activityFeedItems,
  countdownNow,
  displayFirstName,
  giftProgressSummary,
  groups,
  isDarkTheme,
  pendingInvites,
  recipientCount,
  revealMessage,
  unreadNotificationCount,
  wishlistItemCount,
  onCreateGroup,
  onOpenChat,
  onOpenGiftProgress,
  onOpenGroup,
  onOpenGroups,
  onOpenPath,
  onOpenWishlist,
}: DashboardPreviewWorkspaceProps) {
  const focusGroup = getFocusGroup(groups);
  const memberCount = focusGroup?.members.length || 0;
  const readyGiftCount = giftProgressSummary?.readyToGiveCount || 0;
  const giftProgressTotal = giftProgressSummary?.totalAssignments || recipientCount;
  const wishlistTarget = Math.max(5, wishlistItemCount);
  const wishlistPercent = getPercent(Math.min(wishlistItemCount, wishlistTarget), wishlistTarget);
  const lifecycle = buildExchangeLifecycleSummary(
    {
      acceptedCount: memberCount,
      eventDate: focusGroup?.event_date || null,
      giftProgressTotal,
      hasDrawn: Boolean(focusGroup?.hasDrawn || recipientCount > 0),
      isOwner: Boolean(focusGroup?.isOwner),
      memberCount,
      pendingInviteCount: pendingInvites.length,
      readyGiftCount,
      recipientCount,
      wishlistItemCount,
    },
    countdownNow
  );
  const missionSteps = lifecycle.steps.filter((step) =>
    ["setup", "invites", "draw", "giftDay"].includes(step.id)
  );
  const nextActionLabel = focusGroup ? lifecycle.nextAction.label : "Create exchange";
  const nextActionHref = focusGroup ? lifecycle.nextAction.href : "/create-group";
  const missionSummary = !focusGroup
    ? "Create a group, set the gift day and budget, then invite members."
    : pendingInvites.length > 0
      ? "Finish invite confirmations so everyone is ready for the draw."
      : focusGroup.hasDrawn
        ? "Names are drawn. Keep wishlist, shopping, and gift progress moving."
        : "Review the setup, wishlists, and draw readiness for this exchange.";
  const pendingWorkCount = pendingInvites.length + unreadNotificationCount;

  return (
    <DashboardCommandDesk
      activityFeedItems={activityFeedItems}
      displayFirstName={displayFirstName}
      focusGroup={focusGroup}
      giftProgressTotal={giftProgressTotal}
      groups={groups}
      isDarkTheme={isDarkTheme}
      memberCount={memberCount}
      missionSteps={missionSteps}
      missionSummary={missionSummary}
      nextActionHref={nextActionHref}
      nextActionLabel={nextActionLabel}
      pendingInvites={pendingInvites}
      pendingWorkCount={pendingWorkCount}
      readinessPercent={lifecycle.readinessPercent}
      readyGiftCount={readyGiftCount}
      revealMessage={revealMessage}
      unreadNotificationCount={unreadNotificationCount}
      wishlistItemCount={wishlistItemCount}
      wishlistPercent={wishlistPercent}
      wishlistTarget={wishlistTarget}
      onCreateGroup={onCreateGroup}
      onOpenChat={onOpenChat}
      onOpenGiftProgress={onOpenGiftProgress}
      onOpenGroup={onOpenGroup}
      onOpenGroups={onOpenGroups}
      onOpenPath={onOpenPath}
      onOpenWishlist={onOpenWishlist}
    />
  );
}
