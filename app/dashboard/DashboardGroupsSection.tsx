"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DashboardGroupsWorkspace } from "./DashboardGroupsWorkspace";
import { ArrowRightIcon, GiftIcon, UserOutlineIcon, WishlistIcon } from "./dashboard-icons";
import type { Group } from "./dashboard-types";

type DashboardGroupsSectionProps = {
  countdownNow: number;
  deletingGroupId: string | null;
  invitedGroups: Group[];
  isDarkTheme: boolean;
  ownedGroups: Group[];
  totalDashboardGroupCount: number;
  onCreateGroup: () => void;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
  onOpenGroup: (groupId: string) => void;
};

export function DashboardGroupsSection({
  countdownNow,
  deletingGroupId,
  invitedGroups,
  isDarkTheme,
  ownedGroups,
  totalDashboardGroupCount,
  onCreateGroup,
  onDeleteGroup,
  onOpenGroup,
}: DashboardGroupsSectionProps) {
  const dashboardPanelHeadingClass = isDarkTheme ? "text-white" : "text-slate-900";
  const dashboardPanelTextClass = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const dashboardStatLabelClass = isDarkTheme ? "text-slate-500" : "text-slate-400";
  const allGroups = useMemo(
    () => [...ownedGroups, ...invitedGroups],
    [invitedGroups, ownedGroups]
  );
  const hasGroups = totalDashboardGroupCount > 0;
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const focusedGroup =
    allGroups.find((group) => group.id === focusedGroupId) || allGroups[0] || null;

  return (
    <section id="dashboard-groups" className="scroll-mt-24">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${dashboardStatLabelClass}`}>
            My groups
          </p>
          <h2 className={`mt-2 text-2xl font-black tracking-tight ${dashboardPanelHeadingClass}`}>
            Your Groups
          </h2>
          <p className={`mt-1 max-w-2xl text-sm leading-6 ${dashboardPanelTextClass}`}>
            Choose an exchange, then manage members, wishlists, matches, messages, and settings from one workspace.
          </p>
        </div>
        {hasGroups && (
          <button
            type="button"
            onClick={onCreateGroup}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-extrabold transition hover:-translate-y-0.5 active:translate-y-0 ${
              isDarkTheme
                ? "bg-red-500/12 text-red-200"
                : "bg-white text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,0.18),0_10px_24px_rgba(46,52,50,0.05)]"
            }`}
          >
            New group
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!hasGroups ? (
        <section
          className={`relative overflow-hidden rounded-[30px] p-6 sm:p-8 ${
            isDarkTheme ? "holiday-panel-dark text-slate-100" : "holiday-panel-strong text-[#2e3432]"
          }`}
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
            <div className="min-w-0">
              <p className={`text-[12px] font-black uppercase tracking-[0.18em] ${dashboardStatLabelClass}`}>
                Start here
              </p>
              <h3
                className={`mt-4 max-w-2xl text-3xl font-black leading-tight sm:text-4xl ${
                  isDarkTheme ? "text-white" : "text-[#171717]"
                }`}
                style={{ fontFamily: "'Fredoka', sans-serif" }}
              >
                Create your first exchange
              </h3>
              <p className={`mt-3 max-w-xl text-[15px] leading-7 ${dashboardPanelTextClass}`}>
                Set the gift day, budget, and invite list once. Your group workspace will keep members, wishlists, messages, and draw details together.
              </p>
              <button
                type="button"
                onClick={onCreateGroup}
                className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#48664e] px-6 text-[15px] font-extrabold text-white shadow-[0_16px_32px_rgba(72,102,78,0.18)] transition hover:-translate-y-0.5 active:translate-y-0"
              >
                Create group
                <ArrowRightIcon />
              </button>
            </div>

            <aside
              className={`rounded-[26px] p-5 ${
                isDarkTheme
                  ? "bg-slate-900/50 text-slate-100"
                  : "bg-[#f2f4f2] text-[#2e3432] shadow-[inset_0_0_0_1px_rgba(72,102,78,0.08)]"
              }`}
              aria-label="Group workspace preview"
            >
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#7b5902]">
                Group workspace
              </p>
              <div className="mt-4 space-y-3">
                <EmptyGroupPreviewRow
                  icon={<GiftIcon className="h-5 w-5" />}
                  isDarkTheme={isDarkTheme}
                  label="Gift day and budget"
                />
                <EmptyGroupPreviewRow
                  icon={<UserOutlineIcon className="h-5 w-5" />}
                  isDarkTheme={isDarkTheme}
                  label="Member invites"
                />
                <EmptyGroupPreviewRow
                  icon={<WishlistIcon className="h-5 w-5" />}
                  isDarkTheme={isDarkTheme}
                  label="Wishlists and matches"
                />
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <DashboardGroupsWorkspace
          countdownNow={countdownNow}
          deletingGroupId={deletingGroupId}
          focusedGroup={focusedGroup}
          groups={allGroups}
          isDarkTheme={isDarkTheme}
          onDeleteGroup={onDeleteGroup}
          onOpenGroup={onOpenGroup}
          onSelectGroup={setFocusedGroupId}
        />
      )}
    </section>
  );
}

function EmptyGroupPreviewRow({
  icon,
  isDarkTheme,
  label,
}: {
  icon: ReactNode;
  isDarkTheme: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex min-h-13 items-center gap-3 rounded-2xl px-4 text-sm font-black shadow-[inset_0_0_0_1px_rgba(72,102,78,0.08)] ${
        isDarkTheme ? "bg-white/10 text-slate-100" : "bg-white/72 text-[#48664e]"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isDarkTheme ? "bg-white/10 text-[#d7fadb]" : "bg-[#d7fadb] text-[#48664e]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">{label}</span>
    </div>
  );
}
