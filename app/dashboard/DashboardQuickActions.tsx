import { DashboardActionCard } from "./DashboardActionCard";
import { ChatIcon, GiftIcon, PlusIcon } from "./dashboard-icons";

type DashboardQuickActionsProps = {
  hasAssignments: boolean;
  isDarkTheme: boolean;
  onCreateGroup: () => void;
  onOpenChat: () => void;
  onOpenSecretSanta: () => void;
};

export function DashboardQuickActions({
  hasAssignments,
  isDarkTheme,
  onCreateGroup,
  onOpenChat,
  onOpenSecretSanta,
}: DashboardQuickActionsProps) {
  return (
    <section data-fade className="mb-12 grid gap-6 md:grid-cols-3">
      <DashboardActionCard
        accent="rose"
        title={hasAssignments ? "View Recipient" : "No Recipient Yet"}
        description={
          hasAssignments
            ? "See who you are giving a gift to."
            : "Your recipient will appear after the draw."
        }
        isDarkTheme={isDarkTheme}
        onClick={onOpenSecretSanta}
        icon={<GiftIcon className="h-8 w-8" />}
      />
      <DashboardActionCard
        accent="green"
        title="Secret Santa Chat"
        description="Ask private questions without revealing the surprise."
        isDarkTheme={isDarkTheme}
        onClick={onOpenChat}
        icon={<ChatIcon className="h-8 w-8" />}
      />
      <DashboardActionCard
        accent="blue"
        title="New Group"
        description="Create a Secret Santa group and invite members."
        isDarkTheme={isDarkTheme}
        onClick={onCreateGroup}
        icon={<PlusIcon className="h-8 w-8" />}
      />
    </section>
  );
}
