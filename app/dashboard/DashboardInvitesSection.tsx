import dynamic from "next/dynamic";
import type { PendingInvite } from "./dashboard-types";

type InviteCardProps = {
  groupId: string;
  groupName: string;
  eventDate: string;
  description?: string;
  requiresAnonymousNickname?: boolean;
};

type DashboardInvitesSectionProps = {
  pendingInvites: PendingInvite[];
};

const InviteCard = dynamic<InviteCardProps>(() => import("./InviteCard"), {
  loading: () => null,
});

export function DashboardInvitesSection({ pendingInvites }: DashboardInvitesSectionProps) {
  if (pendingInvites.length === 0) {
    return null;
  }

  return (
    <section data-fade className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
            Invitations
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900">Pending invites</h2>
        </div>
        <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
          {pendingInvites.length} waiting
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {pendingInvites.map((invite) => (
          <InviteCard
            key={invite.group_id}
            groupId={invite.group_id}
            groupName={invite.group_name}
            eventDate={invite.group_event_date}
            description={invite.group_description}
            requiresAnonymousNickname={invite.require_anonymous_nickname}
          />
        ))}
      </div>
    </section>
  );
}
