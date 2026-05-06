import type { ReactNode } from "react";
import Link from "next/link";
import { getAvatarLabel, getDashboardMemberLabel } from "./dashboard-formatters";
import { ArrowRightIcon, GiftIcon } from "./dashboard-icons";
import type { Group, GroupMember } from "./dashboard-types";

export function MembersTable({ group, isDarkTheme }: { group: Group; isDarkTheme: boolean }) {
  return (
    <section
      className={`min-w-0 rounded-3xl p-5 shadow-[0_12px_30px_rgba(45,51,55,0.04)] ${
        isDarkTheme ? "bg-slate-900/80 text-slate-100" : "bg-white/95 text-[#2e3432]"
      }`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-black">Members ({group.members.length})</h3>
          <p className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-500"}>
            Monitor participation and open the full group for member actions.
          </p>
        </div>
        <Link
          href={`/group/${group.id}#group-members`}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,0.14)] transition hover:-translate-y-0.5"
        >
          Open member list
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
      <div className="space-y-3 md:hidden">
        {group.members.map((member, index) => (
          <MemberMobileCard
            key={`${group.id}-${member.email || member.nickname || index}-mobile`}
            group={group}
            index={index}
            member={member}
          />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-white/75 shadow-[inset_0_0_0_1px_rgba(72,102,78,0.1)] md:block">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-[44%]" />
            <col className="w-[24%]" />
            <col className="w-[32%]" />
          </colgroup>
          <thead>
            <tr className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <th scope="col" className="px-4 py-3">Member</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Wishlist</th>
            </tr>
          </thead>
          <tbody>
            {group.members.map((member, index) => (
              <tr
                key={`${group.id}-${member.email || member.nickname || index}`}
                className="text-sm font-bold text-slate-700 odd:bg-[#f9faf8]"
              >
                <td className="min-w-0 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar group={group} index={index} member={member} />
                    <span className="min-w-0 flex-1 whitespace-normal break-words leading-5">
                      {getDashboardMemberLabel(
                        member,
                        group.require_anonymous_nickname,
                        `Member ${index + 1}`
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <MemberStatus role={member.role} />
                </td>
                <td className="px-4 py-3">
                  <InlineAction href={`/group/${group.id}#group-members`} label="Open group" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function EventSummary({
  budgetLabel,
  countdownLabel,
  dateLabel,
  group,
  isDarkTheme,
}: {
  budgetLabel: string;
  countdownLabel: string;
  dateLabel: string;
  group: Group;
  isDarkTheme: boolean;
}) {
  const participationLabel = `${group.members.length} accepted`;

  return (
    <section
      className={`rounded-3xl p-5 shadow-[0_12px_30px_rgba(45,51,55,0.04)] ${
        isDarkTheme ? "bg-slate-900/80 text-slate-100" : "bg-white/95 text-[#2e3432]"
      }`}
    >
      <h3 className={isDarkTheme ? "text-lg font-black text-white" : "text-lg font-black text-[#2e3432]"}>
        Event summary
      </h3>
      <p className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-500"}>
        Key dates and details for this exchange.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <SummaryTile isDarkTheme={isDarkTheme} label="Gift day" value={dateLabel} helper={countdownLabel} />
        <SummaryTile isDarkTheme={isDarkTheme} label="Group budget" value={budgetLabel} helper="Per person" />
        <SummaryTile
          isDarkTheme={isDarkTheme}
          label="Draw status"
          value={group.hasDrawn ? "Names drawn" : "Ready soon"}
          helper={group.hasDrawn ? "Matches are ready" : "Open the group to draw"}
        />
        <SummaryTile isDarkTheme={isDarkTheme} label="Participation" value={participationLabel} helper="Active members" />
      </div>
    </section>
  );
}

export function GroupGiftBadge() {
  return (
    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,0.12),0_12px_26px_rgba(72,102,78,0.08)]">
      <GiftIcon className="h-8 w-8" />
      <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-[#fcce72]" />
    </span>
  );
}

export function MetaItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {label}
    </span>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="4" y="5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 3.5v3M13 3.5v3M4 8.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BudgetIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4.5 7.5h11v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5M12.5 11h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SummaryTile({
  helper,
  isDarkTheme,
  label,
  value,
}: {
  helper: string;
  isDarkTheme: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={`rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(72,102,78,0.1)] ${isDarkTheme ? "bg-slate-800" : "bg-white"}`}>
      <p className={isDarkTheme ? "text-xs font-bold text-slate-300" : "text-xs font-bold text-slate-500"}>{label}</p>
      <p className={isDarkTheme ? "mt-2 text-lg font-black text-white" : "mt-2 text-lg font-black text-[#48664e]"}>{value}</p>
      <p className={isDarkTheme ? "mt-2 text-xs text-slate-300" : "mt-2 text-xs text-slate-500"}>{helper}</p>
    </div>
  );
}

function MemberMobileCard({
  group,
  index,
  member,
}: {
  group: Group;
  index: number;
  member: GroupMember;
}) {
  return (
    <div className="rounded-2xl bg-white/80 p-4 shadow-[inset_0_0_0_1px_rgba(72,102,78,0.1)]">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full min-w-0 items-center gap-3">
          <MemberAvatar group={group} index={index} member={member} />
          <span className="min-w-0 flex-1 whitespace-normal break-words text-sm font-black leading-5 text-[#2e3432]">
            {getDashboardMemberLabel(
              member,
              group.require_anonymous_nickname,
              `Member ${index + 1}`
            )}
          </span>
        </div>
        <div className="shrink-0 self-start sm:self-center">
          <MemberStatus role={member.role} />
        </div>
      </div>
      <div className="mt-3">
        <InlineAction href={`/group/${group.id}#group-members`} label="Open group" />
      </div>
    </div>
  );
}

function MemberStatus({ role }: { role: string }) {
  return (
    <span className="inline-flex min-h-8 items-center justify-center rounded-full bg-[#eaf6ec] px-3 text-xs font-black text-[#48664e]">
      {role === "owner" ? "Owner" : "Accepted"}
    </span>
  );
}

function InlineAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center justify-center rounded-full bg-[#f2f4f2] px-3 text-xs font-black text-[#48664e] transition hover:-translate-y-0.5"
    >
      {label}
    </Link>
  );
}

function MemberAvatar({
  group,
  index,
  member,
}: {
  group: Group;
  index: number;
  member: GroupMember;
}) {
  const label = getDashboardMemberLabel(
    member,
    group.require_anonymous_nickname,
    `Member ${index + 1}`
  );

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#edf3ee] text-xs font-black text-[#48664e] ring-4 ring-white">
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        member.avatarEmoji || getAvatarLabel(label)
      )}
    </span>
  );
}
