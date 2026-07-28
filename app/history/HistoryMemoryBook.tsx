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
    ["Gifting", receiverName === "Private after event" ? "Kept private after event" : `For ${receiverName}`],
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

          <section aria-labelledby="history-event-summary-title" className="holiday-panel mt-7 rounded-3xl p-4 sm:p-5 lg:p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)_auto] lg:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  data-testid="history-event-picture"
                  className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fff8ea] ring-1 ring-[#fcce72]/40"
                >
                  {selectedGroup.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedGroup.image_url}
                      alt={`${selectedGroup.name} group picture`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <SantaMarkIcon size={78} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#48664e]">
                    Event summary
                  </p>
                  <h2
                    id="history-event-summary-title"
                    className="mt-1 break-words text-2xl font-black leading-tight text-[#48664e]"
                  >
                    {selectedGroup.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#fcce72]/22 px-3 py-1 text-xs font-black text-[#7b5902]">
                      {summary?.giftProgressLabel || "Completed"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
                  {selectedGroupFacts.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                        {label}
                      </dt>
                      <dd className="mt-1 break-words text-sm font-black text-[#2e3432]">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {memberPreview.length > 0 && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {memberPreview.map((member, index) => (
                        <span
                          key={`${selectedGroup.id}-${member.email || member.nickname || index}`}
                          className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white text-xs font-black text-[#48664e] ring-2 ring-white"
                          title={getDashboardMemberLabel(
                            member,
                            selectedGroup.require_anonymous_nickname,
                            `Member ${index + 1}`
                          )}
                        >
                          {member.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            member.avatarEmoji ||
                            getAvatarLabel(
                              getDashboardMemberLabel(
                                member,
                                selectedGroup.require_anonymous_nickname,
                                `Member ${index + 1}`
                              )
                            )
                          )}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      {selectedGroup.members.length > memberPreview.length
                        ? `+${selectedGroup.members.length - memberPreview.length} more`
                        : "Event members"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 lg:w-44 lg:flex-col">
                <button
                  type="button"
                  onClick={() => onOpenGroup(selectedGroup.id)}
                  className="gift-button gift-button-primary flex-1 text-sm lg:w-full"
                >
                  View full recap
                  <ArrowRightIcon />
                </button>
                {selectedGroup.isOwner && (
                  <button
                    type="button"
                    onClick={() => void onDeleteGroup(selectedGroup.id, selectedGroup.name)}
                    disabled={deletingGroupId === selectedGroup.id}
                    className="gift-button gift-button-danger flex-1 text-sm lg:w-full"
                  >
                    <TrashIcon />
                    {deletingGroupId === selectedGroup.id ? "Deleting exchange" : "Delete exchange"}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="holiday-panel mt-6 rounded-3xl p-4 sm:p-6">
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
              <div className="mt-5 rounded-2xl bg-[#f3f4f2]/80 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
                <p className="text-base font-black text-[#2e3432]">No past wishlist items</p>
                <p className="mt-1 text-sm font-semibold text-slate-500 sm:mt-0 sm:text-right">
                  This exchange has no saved wishlist items in your history.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {wishlistItems.map((item) => (
                  <article
                    key={item.id}
                    className="holiday-panel-row flex flex-col gap-4 rounded-3xl p-3 sm:flex-row sm:items-center"
                  >
                    <WishlistMemoryThumbnail item={item} />
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-xl font-black leading-7 text-[#2e3432]">
                        {item.item_name}
                      </h3>
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
                          <a
                            href={item.item_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#48664e]/10 px-3 text-xs font-black text-[#48664e] transition hover:-translate-y-0.5"
                          >
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
                      className="gift-button gift-button-danger gift-button-compact shrink-0 text-sm"
                    >
                      <TrashIcon />
                      {deletingWishlistItemId === item.id ? "Deleting" : "Delete permanently"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
