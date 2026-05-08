"use client";

import {
  formatDashboardBudget,
  formatDashboardDate,
  getAvatarLabel,
  getDashboardMemberLabel,
} from "@/app/dashboard/dashboard-formatters";
import { ArrowRightIcon, SantaMarkIcon } from "@/app/dashboard/dashboard-icons";
import type { Group } from "@/app/dashboard/dashboard-types";
import {
  LinkIcon,
  PineCorner,
  SparkMark,
  TrashIcon,
  WishlistMemoryThumbnail,
} from "@/app/history/HistoryMemoryVisuals";
import type { HistoryWishlistItem } from "@/app/history/HistoryGroupCard";

export type HistoryAssignmentSummary = {
  giftProgressLabel: string;
  receiverName: string | null;
};

type HistoryMemoryBookProps = {
  deletingGroupId: string | null;
  deletingWishlistItemId: string | null;
  groups: Group[];
  message: string;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
  onDeleteWishlistItem: (itemId: string, itemName: string) => void | Promise<void>;
  onOpenGroup: (groupId: string) => void;
  onSelectGroup: (groupId: string) => void;
  selectedGroup: Group;
  summariesByGroupId: Record<string, HistoryAssignmentSummary>;
  wishlistItems: HistoryWishlistItem[];
};

function formatHistoryBudget(group: Group): string {
  return formatDashboardBudget(group.budget, group.currency)?.replace(/^P /, "PHP ") || "No budget set";
}

export function HistoryMemoryBook({
  deletingGroupId,
  deletingWishlistItemId,
  groups,
  message,
  onDeleteGroup,
  onDeleteWishlistItem,
  onOpenGroup,
  onSelectGroup,
  selectedGroup,
  summariesByGroupId,
  wishlistItems,
}: HistoryMemoryBookProps) {
  const summary = summariesByGroupId[selectedGroup.id];
  const memberPreview = selectedGroup.members.slice(0, 3);
  const receiverName = summary?.receiverName || "Private after event";
  const selectedGroupFacts = [
    ["Gift date", formatDashboardDate(selectedGroup.event_date)],
    ["Members", String(selectedGroup.members.length)],
    ["You gifted", receiverName],
    ["Group budget", formatHistoryBudget(selectedGroup)],
  ];

  return (
    <main className="relative min-h-screen px-0 py-2 sm:py-3">
      <section id="history-exchange-list" className="holiday-panel-strong relative overflow-hidden rounded-4xl px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
        <PineCorner />
        <div className="relative">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-4xl font-black leading-tight text-[#48664e] sm:text-5xl" style={{ fontFamily: "'Fredoka','Nunito',sans-serif" }}>
                History Memory Book
              </h1>
              <p className="mt-2 max-w-2xl text-base font-semibold leading-7 text-slate-600">
                Look back on a concluded exchange and the memories it created.
              </p>
            </div>

            {groups.length > 1 && (
              <div className="flex max-w-full gap-2 overflow-x-auto rounded-full bg-[#f3f4f2] p-1">
                {groups.map((group) => {
                  const active = group.id === selectedGroup.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelectGroup(group.id)}
                      className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-black transition ${active ? "bg-[#48664e] text-white" : "text-[#48664e] hover:bg-white"}`}
                    >
                      {group.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {message && (
            <p role="status" className="mt-5 rounded-2xl bg-[#fff0ef] px-4 py-3 text-sm font-bold text-[#a43c3f] ring-1 ring-[#a43c3f]/15">
              {message}
            </p>
          )}

          <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <section className="min-w-0">
              <div className="holiday-panel rounded-3xl p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <SparkMark />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7b5902]">
                      Saved memories
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-[#2e3432]">Past Wishlist</h2>
                    <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                      These are your own saved wishlist items from this exchange. You can permanently remove only your items here.
                    </p>
                  </div>
                </div>

                {wishlistItems.length === 0 ? (
                  <div className="holiday-panel-soft mt-6 rounded-3xl border border-dashed border-[#48664e]/18 px-5 py-8 text-center">
                    <h2 className="text-xl font-black text-[#2e3432]">No past wishlist items</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      This exchange does not have saved wishlist items in your history.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {wishlistItems.map((item) => (
                      <article key={item.id} className="holiday-panel-row flex flex-col gap-4 rounded-3xl p-3 sm:flex-row sm:items-center">
                        <WishlistMemoryThumbnail item={item} />
                        <div className="min-w-0 flex-1">
                          <h2 className="break-words text-xl font-black leading-7 text-[#2e3432]">
                            {item.item_name}
                          </h2>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-[#48664e]/10 px-3 py-1 text-xs font-black text-[#48664e]">
                              My note
                            </span>
                            <span className="text-sm font-semibold text-slate-600">
                              {item.item_note || item.item_category || "Saved from this exchange."}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {item.item_link ? (
                              <a href={item.item_link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#48664e]/10 px-3 text-xs font-black text-[#48664e] transition hover:-translate-y-0.5">
                                <LinkIcon />
                                Reference link
                              </a>
                            ) : (
                              <span className="inline-flex min-h-9 items-center rounded-full bg-slate-100 px-3 text-xs font-black text-slate-500">
                                No link saved
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onDeleteWishlistItem(item.id, item.item_name)}
                          disabled={deletingWishlistItemId === item.id}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-black text-[#a43c3f] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <TrashIcon />
                          {deletingWishlistItemId === item.id ? "Deleting" : "Delete permanently"}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <aside className="holiday-panel rounded-3xl p-5 xl:sticky xl:top-26 xl:self-start">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#48664e]">Event recap</p>
                <span className="rounded-full bg-[#48664e]/10 px-3 py-1 text-xs font-black text-[#48664e]">Concluded</span>
              </div>
              <div className="mt-6 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#fff8ea] ring-1 ring-[#fcce72]/40">
                  <SantaMarkIcon size={78} />
                </div>
                <h2 className="mt-4 break-words text-2xl font-black text-[#48664e]">{selectedGroup.name}</h2>
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                {selectedGroupFacts.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                    <dt className="font-bold text-slate-500">{label}</dt>
                    <dd className="break-words text-right font-black text-[#2e3432]">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="my-6 h-px bg-[#48664e]/12" />

              <div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-500">Gift progress</span>
                  <span className="font-black text-[#48664e]">{summary?.giftProgressLabel || "Completed"}</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#e7e8e6]">
                  <div className="h-full w-full rounded-full bg-[#48664e]" />
                </div>
              </div>

              <div className="mt-5 flex -space-x-2">
                {memberPreview.map((member, index) => (
                  <span key={`${selectedGroup.id}-${member.email || member.nickname || index}`} className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-black text-[#48664e] ring-2 ring-white" title={getDashboardMemberLabel(member, selectedGroup.require_anonymous_nickname, `Member ${index + 1}`)}>
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      member.avatarEmoji || getAvatarLabel(getDashboardMemberLabel(member, selectedGroup.require_anonymous_nickname, `Member ${index + 1}`))
                    )}
                  </span>
                ))}
              </div>

              <button type="button" onClick={() => onOpenGroup(selectedGroup.id)} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#48664e] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(72,102,78,.22)] transition hover:-translate-y-0.5">
                View result card
                <ArrowRightIcon />
              </button>
              {selectedGroup.isOwner && (
                <button
                  type="button"
                  onClick={() => void onDeleteGroup(selectedGroup.id, selectedGroup.name)}
                  disabled={deletingGroupId === selectedGroup.id}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#a43c3f]/10 px-5 text-sm font-black text-[#a43c3f] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <TrashIcon />
                  {deletingGroupId === selectedGroup.id ? "Deleting exchange" : "Delete exchange"}
                </button>
              )}
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
