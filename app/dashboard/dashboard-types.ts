export type GroupMember = {
  userId: string | null;
  nickname: string | null;
  email: string | null;
  role: string;
  displayName: string | null;
  avatarEmoji: string | null;
  avatarUrl: string | null;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  budget: number | null;
  currency: string | null;
  owner_id: string;
  created_at: string;
  require_anonymous_nickname: boolean;
  members: GroupMember[];
  isOwner: boolean;
  hasDrawn: boolean;
};

export type PendingInvite = {
  group_id: string;
  group_name: string;
  group_description: string;
  group_event_date: string;
  require_anonymous_nickname: boolean;
};

export type ActionMessage = {
  type: "success" | "error";
  text: string;
} | null;

export type ProfileMenuPosition = {
  top: number;
  left: number;
  width: number;
} | null;

export type GroupRow = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  budget: number | null;
  currency: string | null;
  owner_id: string;
  created_at: string;
  require_anonymous_nickname: boolean;
};

export type GroupMemberRow = {
  group_id: string;
  user_id: string | null;
  nickname: string;
  email: string;
  role: string;
};

export type MembershipRow = {
  id: string;
  group_id: string;
  status: string;
  role: string;
};

export type AssignmentRow = {
  group_id: string;
};

export type MyAssignmentRow = {
  group_id: string;
  receiver_id: string;
  gift_prep_status: string | null;
  gift_prep_updated_at: string | null;
};

export type PendingGroupRow = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  require_anonymous_nickname: boolean;
};

export type WishlistSummaryRow = {
  group_id: string;
};

export type NotificationFeedRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_path: string | null;
  created_at: string;
};

export type DashboardActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  href: string | null;
  icon: string;
  tone: "amber" | "blue" | "emerald" | "rose" | "violet";
};

export type DashboardNotificationPreviewItem = {
  id: string;
  title: string;
  href: string | null;
  icon: string;
  tone: DashboardActivityItem["tone"];
  createdAt: string;
};

export type DashboardTheme = "default" | "midnight";
export type GiftProgressStep = "planning" | "purchased" | "wrapped" | "ready_to_give";

export type GiftProgressSummary = {
  focusStep: GiftProgressStep;
  focusCount: number;
  countsByStep: Record<GiftProgressStep, number>;
  totalAssignments: number;
  readyToGiveCount: number;
  recipientName: string | null;
  groupName: string | null;
};

export type DashboardSnapshot = {
  createdAt: number;
  userId: string;
  userName: string;
  ownedGroups: Group[];
  invitedGroups: Group[];
  pendingInvites: PendingInvite[];
  recipientNames: string[];
  unreadNotificationCount: number;
  wishlistItemCount: number;
  wishlistGroupCount: number;
  giftProgressSummary: GiftProgressSummary | null;
  activityFeedItems: DashboardActivityItem[];
  notificationPreviewItems: DashboardNotificationPreviewItem[];
};

export type PeerProfileRow = {
  user_id: string | null;
  display_name: string | null;
  avatar_emoji: string | null;
  avatar_url: string | null;
};
