"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  formatDashboardBudget,
  formatDashboardDate,
} from "./dashboard-formatters";
import {
  ArrowRightIcon,
  MoreHorizontalIcon,
  TrashIcon,
  UserOutlineIcon,
} from "./dashboard-icons";
import type { Group } from "./dashboard-types";
import {
  BudgetIcon,
  CalendarIcon,
  GroupGiftBadge,
  MetaItem,
} from "./DashboardGroupsWorkspaceParts";
import { GroupHealthRail } from "./DashboardGroupsHealthRail";
import { getGroupHistoryState } from "@/lib/groups/history";

type DashboardGroupsWorkspaceProps = {
  countdownNow: number;
  deletingGroupId: string | null;
  focusedGroup: Group | null;
  groups: Group[];
  isDarkTheme: boolean;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
  onOpenGroup: (groupId: string) => void;
  onSelectGroup: (groupId: string) => void;
};

export function DashboardGroupsWorkspace({
  countdownNow,
  deletingGroupId,
  focusedGroup,
  groups,
  isDarkTheme,
  onDeleteGroup,
  onOpenGroup,
  onSelectGroup,
}: DashboardGroupsWorkspaceProps) {
  if (!focusedGroup) {
    return null;
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="min-w-0 space-y-5">
        {groups.length > 1 && (
          <GroupSwitcher
            focusedGroupId={focusedGroup.id}
            groups={groups}
            isDarkTheme={isDarkTheme}
            onSelectGroup={onSelectGroup}
          />
        )}

        <GroupWorkspacePreview
          countdownNow={countdownNow}
          deletingGroupId={deletingGroupId}
          group={focusedGroup}
          isDarkTheme={isDarkTheme}
          onDeleteGroup={onDeleteGroup}
          onOpenGroup={onOpenGroup}
        />
      </div>

      <GroupHealthRail
        countdownNow={countdownNow}
        group={focusedGroup}
        isDarkTheme={isDarkTheme}
        onOpenGroup={onOpenGroup}
      />
    </div>
  );
}

function GroupSwitcher({
  focusedGroupId,
  groups,
  isDarkTheme,
  onSelectGroup,
}: {
  focusedGroupId: string;
  groups: Group[];
  isDarkTheme: boolean;
  onSelectGroup: (groupId: string) => void;
}) {
  return (
    <div
      className={`rounded-3xl p-2 ${
        isDarkTheme ? "holiday-panel-dark" : "holiday-panel-soft"
      }`}
      aria-label="Choose group"
    >
      <div className="flex gap-2 overflow-x-auto p-1">
        {groups.map((group) => {
          const selected = group.id === focusedGroupId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`gift-button gift-button-compact shrink-0 text-sm ${
                selected ? "gift-button-primary" : "gift-button-secondary"
              }`}
              aria-pressed={selected}
            >
              <span className="max-w-44 truncate">{group.name}</span>
              <span className={selected ? "text-white/80" : "text-slate-400"}>
                {group.members.length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupWorkspacePreview({
  countdownNow,
  deletingGroupId,
  group,
  isDarkTheme,
  onDeleteGroup,
  onOpenGroup,
}: {
  countdownNow: number;
  deletingGroupId: string | null;
  group: Group;
  isDarkTheme: boolean;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
  onOpenGroup: (groupId: string) => void;
}) {
  const budgetLabel = formatDashboardBudget(group.budget, group.currency) || "No budget set";
  const dateLabel = formatDashboardDate(group.event_date);
  const historyState = getGroupHistoryState(group.event_date, new Date(countdownNow));
  const showHistoryNotice = historyState.isGracePeriod && historyState.daysUntilHistory !== null;
  const roleLabel = group.isOwner ? "Owner" : "Member";

  return (
    <section className="min-w-0 space-y-5" aria-label={`${group.name} workspace preview`}>
      <div
        data-testid="group-workspace-card"
        className={`rounded-3xl p-4 ${
          isDarkTheme ? "holiday-panel-dark text-slate-100" : "holiday-panel-strong text-[#2e3432]"
        }`}
      >
        <div className="grid min-w-0 gap-3">
          <div
            data-testid="group-card-identity"
            className="flex min-w-0 items-start gap-4 sm:items-center"
          >
            <GroupGiftBadge imageUrl={group.image_url} />
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <h3
                  className={`line-clamp-2 min-w-0 max-w-full break-words text-[24px] font-black leading-tight [overflow-wrap:anywhere] sm:text-[26px] ${
                    isDarkTheme ? "text-white" : "text-[#48664e]"
                  }`}
                  style={{ fontFamily: "'Fredoka', sans-serif" }}
                  title={group.name}
                >
                  {group.name}
                </h3>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
                    isDarkTheme
                      ? "bg-[#fcce72]/15 text-[#ffe7a8] shadow-[inset_0_0_0_1px_rgba(252,206,114,0.2)]"
                      : "bg-[#fff4df] text-[#7b5902] shadow-[inset_0_0_0_1px_rgba(123,89,2,0.1)]"
                  }`}
                >
                  {roleLabel}
                </span>
              </div>
              <div
                className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-bold sm:text-sm ${
                  isDarkTheme ? "text-slate-300" : "text-[#5b605e]"
                }`}
              >
                <MetaItem icon={<UserOutlineIcon className="h-4 w-4" />} label={`${group.members.length} members`} />
                <MetaItem icon={<CalendarIcon />} label={`Gift day: ${dateLabel}`} />
                <MetaItem icon={<BudgetIcon />} label={`Budget: ${budgetLabel}`} />
              </div>
            </div>
          </div>

          <div
            className="ml-auto flex min-w-0 w-full items-center gap-2 sm:w-auto"
            data-testid="group-card-actions"
          >
            <button
              type="button"
              onClick={() => onOpenGroup(group.id)}
              aria-label={`Open overview for ${group.name}`}
              className="gift-button gift-button-primary gift-button-compact h-11 min-h-11 min-w-0 flex-1 px-4 py-0 text-sm sm:w-36 sm:flex-none"
            >
              <span className="whitespace-nowrap">View group</span>
              <ArrowRightIcon className="h-4 w-4 shrink-0" />
            </button>
            {group.isOwner && (
              <GroupActionsMenu
                deleting={deletingGroupId === group.id}
                groupId={group.id}
                groupName={group.name}
                isDarkTheme={isDarkTheme}
                onDeleteGroup={onDeleteGroup}
              />
            )}
          </div>
        </div>
      </div>

      {showHistoryNotice && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
          Moves to History in {historyState.daysUntilHistory} day
          {historyState.daysUntilHistory === 1 ? "" : "s"}.{" "}
          {group.isOwner
            ? "Update the event date if this exchange is still active."
            : "The owner can update the event date if this exchange is still active."}
        </div>
      )}
    </section>
  );
}

function GroupActionsMenu({
  deleting,
  groupId,
  groupName,
  isDarkTheme,
  onDeleteGroup,
}: {
  deleting: boolean;
  groupId: string;
  groupName: string;
  isDarkTheme: boolean;
  onDeleteGroup: (groupId: string, groupName: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuItemRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    menuItemRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleDelete = () => {
    setOpen(false);
    triggerRef.current?.focus();
    void onDeleteGroup(groupId, groupName);
  };

  return (
    <div
      ref={menuRef}
      className="relative shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        disabled={deleting}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`More actions for ${groupName}`}
        title="More group actions"
        className="gift-shell-control h-11 w-11 shrink-0 rounded-full"
        style={{
          background: isDarkTheme ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.82)",
          borderColor: isDarkTheme ? "rgba(255,255,255,.14)" : "rgba(72,102,78,.16)",
          color: isDarkTheme ? "#f8fafc" : "#48664e",
        }}
      >
        <MoreHorizontalIcon />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Actions for ${groupName}`}
          className="gift-menu-panel absolute right-0 top-full z-30 mt-2 w-48 p-2"
          style={{
            background: isDarkTheme ? "#18231d" : "#fffefa",
            borderColor: isDarkTheme ? "rgba(255,255,255,.14)" : "rgba(72,102,78,.12)",
          }}
        >
          <button
            ref={menuItemRef}
            type="button"
            role="menuitem"
            onClick={handleDelete}
            disabled={deleting}
            className="gift-menu-item flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-[13px] font-extrabold text-[#a43c3f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <TrashIcon className="h-4.5 w-4.5 shrink-0" />
            {deleting ? "Deleting" : "Delete group"}
          </button>
        </div>
      )}
    </div>
  );
}
