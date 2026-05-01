import {
  formatDashboardBudget,
  formatDashboardDate,
  getAvatarLabel,
  getDashboardMemberLabel,
} from "@/app/dashboard/dashboard-formatters";
import { GiftIcon, UserOutlineIcon } from "@/app/dashboard/dashboard-icons";
import type { Group } from "@/app/dashboard/dashboard-types";
import { getGroupHistoryState } from "@/lib/groups/history";

export type HistoryWishlistItem = {
  id: string;
  item_category: string | null;
  item_link: string | null;
  item_name: string;
  item_note: string | null;
  priority: number | null;
};

export function HistoryGroupCard({
  deletingWishlistItemId,
  group,
  onOpenGroup,
  onDeleteWishlistItem,
  wishlistItems,
}: {
  deletingWishlistItemId: string | null;
  group: Group;
  onOpenGroup: (groupId: string) => void;
  onDeleteWishlistItem: (itemId: string, itemName: string) => void | Promise<void>;
  wishlistItems: HistoryWishlistItem[];
}) {
  const budgetLabel = formatDashboardBudget(group.budget, group.currency);
  const historyState = getGroupHistoryState(group.event_date);
  const memberPreview = group.members.slice(0, 4);
  const iconClass = group.isOwner
    ? "bg-[#a43c3f]/10 text-[#a43c3f]"
    : "bg-[#48664e]/10 text-[#48664e]";

  return (
    <article className="rounded-[28px] border border-[rgba(72,102,78,.14)] bg-white/90 p-5 shadow-[0_18px_42px_rgba(46,52,50,.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] ${iconClass}`}>
            {group.isOwner ? <GiftIcon className="h-6 w-6" /> : <UserOutlineIcon className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {group.isOwner ? "Hosted by you" : "Joined as member"}
            </p>
            <h2 className="mt-1 truncate text-[24px] font-black leading-tight text-[#2e3432]">
              {group.name}
            </h2>
            <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-600">
              Gift day: {formatDashboardDate(group.event_date)}
              {budgetLabel ? ` / Budget: ${budgetLabel}` : " / No budget set"}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-slate-500">
              {historyState.label || "Concluded exchange"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenGroup(group.id)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#48664e] px-5 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5"
        >
          Open record
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-[#48664e]/10 px-3 py-1.5 text-[11px] font-black text-[#48664e]">
          {group.members.length} member{group.members.length === 1 ? "" : "s"}
        </span>
        <span className="rounded-full bg-[#fcce72]/20 px-3 py-1.5 text-[11px] font-black text-[#7b5902]">
          Concluded
        </span>
        <div className="flex -space-x-2">
          {memberPreview.map((member, index) => (
            <span
              key={`${group.id}-${member.email || member.nickname || index}`}
              className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white text-[14px] font-black text-slate-600 ring-2 ring-white"
              title={getDashboardMemberLabel(member, group.require_anonymous_nickname)}
            >
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                member.avatarEmoji ||
                getAvatarLabel(getDashboardMemberLabel(member, group.require_anonymous_nickname))
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-3xl bg-[#f8fbff] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7b5902]">
              Past wishlist
            </p>
            <p className="mt-1 text-[13px] font-bold text-slate-600">
              Saved ideas from this concluded exchange.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-500">
            {wishlistItems.length} item{wishlistItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {wishlistItems.length === 0 ? (
          <p className="mt-4 rounded-[18px] border border-dashed border-[rgba(72,102,78,.2)] bg-white/72 px-4 py-3 text-[12px] font-semibold text-slate-500">
            You have no saved wishlist items for this event.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {wishlistItems.map((item) => (
              <div
                key={item.id}
                className="rounded-[20px] border border-[rgba(72,102,78,.12)] bg-white/86 p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#a43c3f]/10 text-[#a43c3f]">
                    <GiftIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-[14px] font-black leading-5 text-[#2e3432]">
                      {item.item_name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-slate-500">
                      {item.item_note || item.item_category || "Past gift idea"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {item.item_link ? (
                    <a
                      href={item.item_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-[#48664e]/10 px-3 py-1.5 text-[11px] font-black text-[#48664e] transition hover:-translate-y-0.5"
                    >
                      Reference link
                    </a>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-500">
                      No link saved
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void onDeleteWishlistItem(item.id, item.item_name)}
                    disabled={deletingWishlistItemId === item.id}
                    className="rounded-full px-3 py-1.5 text-[11px] font-black text-[#a43c3f] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingWishlistItemId === item.id ? "Deleting" : "Delete permanently"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
