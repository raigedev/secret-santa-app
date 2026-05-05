"use client";

import { useState } from "react";
import {
  formatDashboardBudget,
  formatDashboardDate,
  getAvatarLabel,
  getDashboardMemberLabel,
} from "@/app/dashboard/dashboard-formatters";
import { ArrowRightIcon, SantaMarkIcon, UserOutlineIcon } from "@/app/dashboard/dashboard-icons";
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

const HISTORY_TABS = [
  { id: "recap", label: "Recap" },
  { id: "wishlist", label: "Past Wishlist" },
  { id: "result-card", label: "Result Card" },
  { id: "notes", label: "Notes" },
] as const;

type HistoryTabId = (typeof HISTORY_TABS)[number]["id"];

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
  const [activeTab, setActiveTab] = useState<HistoryTabId>("recap");
  const summary = summariesByGroupId[selectedGroup.id];
  const memberPreview = selectedGroup.members.slice(0, 3);
  const receiverName = summary?.receiverName || "Private after event";
  const selectedGroupFacts = [
    ["Gift date", formatDashboardDate(selectedGroup.event_date)],
    ["Members", String(selectedGroup.members.length)],
    ["You gifted", receiverName],
    ["Group budget", formatHistoryBudget(selectedGroup)],
  ];
  const activeTabLabel =
    HISTORY_TABS.find((tab) => tab.id === activeTab)?.label || "Exchange history";

  return (
    <main className="relative min-h-screen px-0 py-2 sm:py-3">
      <section id="history-exchange-list" className="relative overflow-hidden rounded-4xl bg-white/90 px-4 py-5 shadow-[0_24px_70px_rgba(46,52,50,.08)] ring-1 ring-[#48664e]/12 sm:px-7 sm:py-7 lg:px-10">
        <PineCorner />
        <div className="relative">
          <a href="#history-exchange-list" className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-black text-[#48664e] transition hover:-translate-y-0.5">
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
            Back to History
          </a>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
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
              <div
                className="grid grid-cols-2 overflow-hidden rounded-t-3xl bg-[#f3f4f2] ring-1 ring-[#48664e]/12 sm:grid-cols-4"
                role="tablist"
                aria-label="History sections"
              >
                {HISTORY_TABS.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      id={`history-tab-${tab.id}`}
                      role="tab"
                      aria-controls="history-tab-panel"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      className={`min-h-14 px-4 text-sm font-black transition ${active ? "bg-white text-[#48664e]" : "text-slate-500 hover:bg-white/60"}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div
                id="history-tab-panel"
                role="tabpanel"
                aria-labelledby={`history-tab-${activeTab}`}
                className="rounded-b-3xl bg-white/94 p-4 ring-1 ring-[#48664e]/12 sm:p-6"
              >
                <h2 className="sr-only">{activeTabLabel}</h2>

                {activeTab === "recap" && (
                  <div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <SparkMark />
                      <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                        A quick look at the finished exchange, including the gift day, members, budget, and your recipient.
                      </p>
                    </div>
                    <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                      {selectedGroupFacts.map(([label, value]) => (
                        <div key={label} className="rounded-3xl bg-[#f8fbff] px-4 py-4 ring-1 ring-[#48664e]/10">
                          <dt className="text-xs font-black uppercase tracking-[0.14em] text-[#48664e]">
                            {label}
                          </dt>
                          <dd className="mt-2 break-words text-lg font-black text-[#2e3432]">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {activeTab === "wishlist" && (
                  <div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <SparkMark />
                      <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                        These are the items you added to your wishlist for this exchange. Only your own wishlist items can be deleted here.
                      </p>
                    </div>

                    {wishlistItems.length === 0 ? (
                      <div className="mt-6 rounded-3xl border border-dashed border-[#48664e]/18 bg-[#f8fbff] px-5 py-8 text-center">
                        <h2 className="text-xl font-black text-[#2e3432]">No past wishlist items</h2>
                        <p className="mt-2 text-sm font-semibold text-slate-500">
                          This exchange does not have saved wishlist items in your history.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-6 space-y-4">
                        {wishlistItems.map((item) => (
                          <article key={item.id} className="flex flex-col gap-4 rounded-3xl bg-white p-3 shadow-[0_12px_28px_rgba(46,52,50,.045)] ring-1 ring-[#48664e]/12 sm:flex-row sm:items-center">
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
                )}

                {activeTab === "result-card" && (
                  <div className="rounded-3xl bg-[#f8fbff] px-5 py-8 text-center ring-1 ring-[#48664e]/10">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#fff8ea] ring-1 ring-[#fcce72]/40">
                      <SantaMarkIcon size={62} />
                    </div>
                    <h2 className="mt-5 text-2xl font-black text-[#2e3432]">Open the result card</h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
                      Review the finished exchange card with your recipient, gift progress, and event details.
                    </p>
                    <button type="button" onClick={() => onOpenGroup(selectedGroup.id)} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#48664e] px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(72,102,78,.22)] transition hover:-translate-y-0.5">
                      View result card
                      <ArrowRightIcon />
                    </button>
                  </div>
                )}

                {activeTab === "notes" && (
                  <div className="rounded-3xl bg-[#f8fbff] px-5 py-8 ring-1 ring-[#48664e]/10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <SparkMark />
                      <div>
                        <h2 className="text-2xl font-black text-[#2e3432]">Private history notes</h2>
                        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                          Wishlist items stay private after the exchange. Keep only the memories and saved gift clues you still need.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center gap-4 rounded-3xl bg-[#f8fbff]/86 px-5 py-4 ring-1 ring-[#48664e]/12">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#48664e]">
                  <UserOutlineIcon className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold leading-6 text-slate-600">
                  Wishlist items are private. Other members can only see what you shared during the exchange.
                </p>
              </div>
            </section>

            <aside className="rounded-3xl bg-white/94 p-5 shadow-[0_18px_42px_rgba(46,52,50,.055)] ring-1 ring-[#48664e]/12 xl:sticky xl:top-26 xl:self-start">
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
