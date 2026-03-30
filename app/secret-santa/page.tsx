"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  addWishlistItem,
  deleteWishlistItem,
  editWishlistItem,
} from "@/app/dashboard/wishlist-actions";
import { confirmGiftReceived } from "./actions";
import { SecretSantaSkeleton } from "@/app/components/PageSkeleton";

type WishlistItem = {
  id: string;
  group_id: string;
  item_name: string;
  item_link: string;
  item_note: string;
  priority: number;
};

type RecipientData = {
  group_id: string;
  group_name: string;
  group_event_date: string;
  receiver_nickname: string;
  receiver_wishlist: WishlistItem[];
  gift_received: boolean;
  gift_received_at: string | null;
};

type GroupOption = {
  id: string;
  name: string;
  eventDate: string;
};

type ActionMessage = {
  type: "success" | "error";
  text: string;
} | null;

type GroupRow = {
  id: string;
  name: string | null;
  event_date: string | null;
};

type AssignmentRow = {
  group_id: string;
  receiver_id: string;
};

type ReceivedAssignmentRow = {
  group_id: string;
  gift_received: boolean | null;
  gift_received_at: string | null;
};

type MemberRow = {
  group_id: string;
  user_id: string;
  nickname: string | null;
};

type WishlistRow = {
  id: string;
  group_id: string;
  user_id: string;
  item_name: string;
  item_link: string | null;
  item_note: string | null;
  priority: number | null;
};

const ITEM_NAME_MAX_LENGTH = 100;
const ITEM_NOTE_MAX_LENGTH = 200;
const ITEM_LINK_MAX_LENGTH = 500;

const ICON_COLORS = [
  "rgba(37,99,235,.15)",
  "rgba(34,197,94,.15)",
  "rgba(251,191,36,.15)",
  "rgba(168,85,247,.15)",
];

const ICON_EMOJIS = ["🏢", "👨‍👩‍👧‍👦", "🍻", "🎄"];

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// A composite lookup key keeps group-specific user data fast to resolve.
// This avoids repeatedly scanning arrays when building recipient cards.
function createGroupUserKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
}

// Normalize text before it is submitted so the UI and server action receive cleaner input.
// The server action is still the real security boundary.
function normalizeTextInput(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// Only allow standard web links to be submitted or rendered from this page.
// That gives the UI one more guardrail against unsupported protocols.
function normalizeOptionalUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return trimmed.slice(0, ITEM_LINK_MAX_LENGTH);
  } catch {
    return "";
  }
}

// Convert raw database rows into the smaller UI model used by the page.
function toWishlistItem(row: WishlistRow): WishlistItem {
  return {
    id: row.id,
    group_id: row.group_id,
    item_name: row.item_name,
    item_link: row.item_link || "",
    item_note: row.item_note || "",
    priority: row.priority || 0,
  };
}

// Keep important wishlist items visible first and make the order predictable.
function sortWishlistItems(items: WishlistItem[]): WishlistItem[] {
  return [...items].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.item_name.localeCompare(right.item_name);
  });
}

// Sort groups by event date and then by name so the UI stays stable and readable.
function buildAvailableGroups(groups: GroupRow[]): GroupOption[] {
  return groups
    .map((group) => ({
      id: group.id,
      name: group.name || "Unknown Group",
      eventDate: group.event_date || "",
    }))
    .sort((left, right) => {
      const leftTime = new Date(left.eventDate).getTime();
      const rightTime = new Date(right.eventDate).getTime();

      if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.name.localeCompare(right.name);
    });
}

// Build recipient cards from raw rows using maps instead of repeated find/filter calls.
function buildRecipientData(
  assignments: AssignmentRow[],
  groups: GroupOption[],
  receivedAssignments: ReceivedAssignmentRow[],
  receiverMembers: MemberRow[],
  receiverWishlists: WishlistRow[]
): RecipientData[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const receivedByGroupId = new Map(
    receivedAssignments.map((assignment) => [assignment.group_id, assignment])
  );
  const membersByKey = new Map(
    receiverMembers.map((member) => [
      createGroupUserKey(member.group_id, member.user_id),
      member,
    ])
  );
  const wishlistsByKey = new Map<string, WishlistItem[]>();
  const groupOrder = new Map(groups.map((group, index) => [group.id, index]));

  for (const wishlist of receiverWishlists) {
    const key = createGroupUserKey(wishlist.group_id, wishlist.user_id);
    const currentItems = wishlistsByKey.get(key) || [];
    currentItems.push(toWishlistItem(wishlist));
    wishlistsByKey.set(key, currentItems);
  }

  return assignments
    .map((assignment) => {
      const group = groupsById.get(assignment.group_id);
      const receiver = membersByKey.get(
        createGroupUserKey(assignment.group_id, assignment.receiver_id)
      );
      const receivedStatus = receivedByGroupId.get(assignment.group_id);

      return {
        group_id: assignment.group_id,
        group_name: group?.name || "Unknown Group",
        group_event_date: group?.eventDate || "",
        receiver_nickname: receiver?.nickname || "Secret Participant",
        receiver_wishlist: sortWishlistItems(
          wishlistsByKey.get(
            createGroupUserKey(assignment.group_id, assignment.receiver_id)
          ) || []
        ),
        gift_received: Boolean(receivedStatus?.gift_received),
        gift_received_at: receivedStatus?.gift_received_at || null,
      };
    })
    .sort((left, right) => {
      return (
        (groupOrder.get(left.group_id) ?? Number.MAX_SAFE_INTEGER) -
        (groupOrder.get(right.group_id) ?? Number.MAX_SAFE_INTEGER)
      );
    });
}

// Group the user's own wishlist items cleanly so related entries stay together.
function buildMyWishlistItems(rows: WishlistRow[], groups: GroupOption[]): WishlistItem[] {
  const groupNamesById = new Map(groups.map((group) => [group.id, group.name]));

  return rows.map(toWishlistItem).sort((left, right) => {
    const groupCompare = (groupNamesById.get(left.group_id) || "Unknown Group").localeCompare(
      groupNamesById.get(right.group_id) || "Unknown Group"
    );

    if (groupCompare !== 0) {
      return groupCompare;
    }

    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.item_name.localeCompare(right.item_name);
  });
}

// Format all dates defensively so empty or invalid values never surface as "Invalid Date".
function formatDisplayDate(value: string | null): string {
  if (!value) {
    return "Date unavailable";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return DATE_FORMATTER.format(parsedDate);
}

// Make success and error messages explicit instead of inferring them from punctuation.
function createActionMessage(result: {
  success: boolean;
  message: string;
}): ActionMessage {
  return {
    type: result.success ? "success" : "error",
    text: result.message,
  };
}

export default function SecretSantaPage() {
  const router = useRouter();

  // The Supabase client is created once for the lifetime of this page.
  // That keeps auth calls and realtime subscriptions stable across rerenders.
  const [supabase] = useState(() => createClient());

  // Remote data displayed throughout the page.
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>([]);
  const [assignments, setAssignments] = useState<RecipientData[]>([]);
  const [myItems, setMyItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state.
  const [showAdd, setShowAdd] = useState(false);
  const [addGroupId, setAddGroupId] = useState("");
  const [addName, setAddName] = useState("");
  const [addLink, setAddLink] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addPriority, setAddPriority] = useState(0);
  const [addLoading, setAddLoading] = useState(false);

  // Edit form state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPriority, setEditPriority] = useState(0);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // Page-level feedback and action state.
  const [message, setMessage] = useState<ActionMessage>(null);
  const [confirmingGroup, setConfirmingGroup] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Load every dataset needed by the page in one place.
    // This centralizes error handling and prevents duplicated state sync logic.
    const loadData = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          router.replace("/login");
          return;
        }

        const user = session.user;

        const { data: memberRows, error: memberRowsError } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)
          .eq("status", "accepted");

        if (memberRowsError) {
          throw memberRowsError;
        }

        const groupIds = [...new Set((memberRows || []).map((row) => row.group_id))];

        if (!isMounted) {
          return;
        }

        if (groupIds.length === 0) {
          setAvailableGroups([]);
          setAssignments([]);
          setMyItems([]);
          setAddGroupId("");
          setLoading(false);
          return;
        }

        const [
          { data: groupsData, error: groupsError },
          { data: myAssignments, error: myAssignmentsError },
          { data: receivedAssignments, error: receivedAssignmentsError },
          { data: myWishlistData, error: myWishlistError },
        ] = await Promise.all([
          supabase.from("groups").select("id, name, event_date").in("id", groupIds),
          supabase
            .from("assignments")
            .select("group_id, receiver_id")
            .eq("giver_id", user.id)
            .in("group_id", groupIds),
          supabase
            .from("assignments")
            .select("group_id, gift_received, gift_received_at")
            .eq("receiver_id", user.id)
            .in("group_id", groupIds),
          supabase
            .from("wishlists")
            .select("id, group_id, user_id, item_name, item_link, item_note, priority")
            .eq("user_id", user.id)
            .in("group_id", groupIds),
        ]);

        const primaryError =
          groupsError || myAssignmentsError || receivedAssignmentsError || myWishlistError;
        if (primaryError) {
          throw primaryError;
        }

        const groupOptions = buildAvailableGroups((groupsData || []) as GroupRow[]);
        let recipientData: RecipientData[] = [];

        if ((myAssignments || []).length > 0) {
          const receiverIds = [
            ...new Set((myAssignments || []).map((assignment) => assignment.receiver_id)),
          ];

          const [
            { data: receiverMembers, error: receiverMembersError },
            { data: receiverWishlists, error: receiverWishlistsError },
          ] = await Promise.all([
            supabase
              .from("group_members")
              .select("group_id, user_id, nickname")
              .in("user_id", receiverIds)
              .in("group_id", groupIds)
              .eq("status", "accepted"),
            supabase
              .from("wishlists")
              .select("id, group_id, user_id, item_name, item_link, item_note, priority")
              .in("user_id", receiverIds)
              .in("group_id", groupIds),
          ]);

          if (receiverMembersError || receiverWishlistsError) {
            throw receiverMembersError || receiverWishlistsError;
          }

          recipientData = buildRecipientData(
            (myAssignments || []) as AssignmentRow[],
            groupOptions,
            (receivedAssignments || []) as ReceivedAssignmentRow[],
            (receiverMembers || []) as MemberRow[],
            (receiverWishlists || []) as WishlistRow[]
          );
        }

        if (!isMounted) {
          return;
        }

        setAvailableGroups(groupOptions);
        setAssignments(recipientData);
        setMyItems(buildMyWishlistItems((myWishlistData || []) as WishlistRow[], groupOptions));
        setAddGroupId((currentGroupId) => {
          const validGroupIds = new Set(groupOptions.map((group) => group.id));

          if (currentGroupId && validGroupIds.has(currentGroupId)) {
            return currentGroupId;
          }

          return groupOptions[0]?.id || "";
        });
      } catch (error) {
        console.error("[SecretSantaPage] Failed to load page data:", error);

        if (!isMounted) {
          return;
        }

        setAvailableGroups([]);
        setAssignments([]);
        setMyItems([]);
        setAddGroupId("");
        setMessage({
          type: "error",
          text: "Failed to load your Secret Santa data. Please refresh and try again.",
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    // Refresh visible data when related rows change in Supabase.
    const channel = supabase
      .channel("santa-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlists" },
        () => void loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        () => void loadData()
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const handleAdd = async () => {
    const cleanName = normalizeTextInput(addName, ITEM_NAME_MAX_LENGTH);
    const cleanLink = normalizeOptionalUrl(addLink);
    const cleanNote = normalizeTextInput(addNote, ITEM_NOTE_MAX_LENGTH);
    const validGroupIds = new Set(availableGroups.map((group) => group.id));

    if (!cleanName) {
      setMessage({ type: "error", text: "Item name is required." });
      return;
    }

    if (!addGroupId || !validGroupIds.has(addGroupId)) {
      setMessage({ type: "error", text: "Select a valid group first." });
      return;
    }

    setAddLoading(true);
    setMessage(null);

    try {
      const result = await addWishlistItem(
        addGroupId,
        cleanName,
        cleanLink,
        cleanNote,
        addPriority > 0 ? 1 : 0
      );

      setMessage(createActionMessage(result));

      if (result.success) {
        setAddName("");
        setAddLink("");
        setAddNote("");
        setAddPriority(0);
        setShowAdd(false);
      }
    } catch (error) {
      console.error("[SecretSantaPage] Failed to add wishlist item:", error);
      setMessage({
        type: "error",
        text: "Failed to save the wishlist item. Please try again.",
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async (itemId: string) => {
    const cleanName = normalizeTextInput(editName, ITEM_NAME_MAX_LENGTH);
    const cleanLink = normalizeOptionalUrl(editLink);
    const cleanNote = normalizeTextInput(editNote, ITEM_NOTE_MAX_LENGTH);

    if (!cleanName) {
      setMessage({ type: "error", text: "Item name is required." });
      return;
    }

    setEditLoadingId(itemId);
    setMessage(null);

    try {
      const result = await editWishlistItem(
        itemId,
        cleanName,
        cleanLink,
        cleanNote,
        editPriority > 0 ? 1 : 0
      );

      setMessage(createActionMessage(result));

      if (result.success) {
        setEditingId(null);
      }
    } catch (error) {
      console.error("[SecretSantaPage] Failed to edit wishlist item:", error);
      setMessage({
        type: "error",
        text: "Failed to update the wishlist item. Please try again.",
      });
    } finally {
      setEditLoadingId(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Delete this wishlist item?")) {
      return;
    }

    setDeleteLoadingId(itemId);
    setMessage(null);

    try {
      const result = await deleteWishlistItem(itemId);
      setMessage(createActionMessage(result));
    } catch (error) {
      console.error("[SecretSantaPage] Failed to delete wishlist item:", error);
      setMessage({
        type: "error",
        text: "Failed to delete the wishlist item. Please try again.",
      });
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleConfirmGift = async (groupId: string) => {
    if (!confirm("Confirm that you received your gift? This can't be undone.")) {
      return;
    }

    setConfirmingGroup(groupId);
    setMessage(null);

    try {
      const result = await confirmGiftReceived(groupId);
      setMessage(createActionMessage(result));
    } catch (error) {
      console.error("[SecretSantaPage] Failed to confirm gift receipt:", error);
      setMessage({
        type: "error",
        text: "Failed to confirm gift receipt. Please try again.",
      });
    } finally {
      setConfirmingGroup(null);
    }
  };

  const startEdit = (item: WishlistItem) => {
    setEditingId(item.id);
    setEditName(item.item_name);
    setEditLink(item.item_link);
    setEditNote(item.item_note);
    setEditPriority(item.priority);
    setMessage(null);
  };

  const getGroupName = (groupId: string) => {
    return availableGroups.find((group) => group.id === groupId)?.name || "Unknown Group";
  };

  if (loading) {
    return <SecretSantaSkeleton />;
  }

  const assignmentGroupCount = new Set(assignments.map((assignment) => assignment.group_id)).size;

  return (
    <main
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background:
          "linear-gradient(180deg,#1a0a0a 0%,#2d1010 20%,#3d1515 50%,#2d1010 80%,#1a0a0a 100%)",
        fontFamily: "'Nunito', sans-serif",
        color: "#fff",
      }}
    >
      <div
        id="snowWrap"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      />
      <style>{`
        .snowflake{position:absolute;background:#fff;border-radius:50%;animation:fall linear infinite;}
        @keyframes fall{0%{transform:translateY(-10px) translateX(0);opacity:.6;}50%{transform:translateY(50vh) translateX(12px);}100%{transform:translateY(105vh) translateX(-6px);opacity:.1;}}
      `}</style>

      <div className="relative z-10 max-w-[720px] mx-auto px-4 py-6">
        {/* Primary navigation back to the dashboard. */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-5 px-4 py-2 rounded-lg transition"
          style={{
            color: "rgba(255,255,255,.6)",
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.1)",
            fontFamily: "inherit",
          }}
        >
          ← Back to Dashboard
        </button>

        {/* Header content and recipient summary. */}
        <div className="text-center mb-7">
          <h1
            className="text-[32px] font-bold mb-1"
            style={{
              fontFamily: "'Fredoka', sans-serif",
              textShadow: "0 2px 8px rgba(0,0,0,.3)",
            }}
          >
            🎅 Your Secret Santa
          </h1>
          <p
            className="text-[14px] font-semibold"
            style={{ color: "rgba(255,255,255,.5)" }}
          >
            Your mystery recipients from all events
          </p>
          {assignments.length > 0 && (
            <div
              className="inline-flex items-center gap-1.5 text-[12px] font-extrabold mt-2.5 px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(220,38,38,.2)",
                color: "#fca5a5",
                border: "1px solid rgba(220,38,38,.15)",
              }}
            >
              🎁 {assignments.length} Recipient{assignments.length > 1 ? "s" : ""} across{" "}
              {assignmentGroupCount} group{assignmentGroupCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Structured status messaging keeps success and error feedback explicit. */}
        {message && (
          <p
            role="status"
            aria-live="polite"
            className={`text-[11px] font-bold mb-4 ${
              message.type === "success" ? "text-green-400" : "text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* Recipient cards show assigned recipients, their wishlist items, and gift confirmation state. */}
        {assignments.length === 0 ? (
          <div
            className="text-center py-12 mb-7 rounded-[18px]"
            style={{
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div className="text-[48px] mb-3">🎲</div>
            <div
              className="text-[18px] font-bold"
              style={{
                fontFamily: "'Fredoka', sans-serif",
                color: "rgba(255,255,255,.7)",
              }}
            >
              No assignments yet
            </div>
            <p
              className="text-[13px] mt-1"
              style={{ color: "rgba(255,255,255,.35)" }}
            >
              Once a group owner draws names, your recipients will appear here!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mb-7">
            {assignments.map((assignment, index) => (
              <div
                key={assignment.group_id}
                className="rounded-[18px] overflow-hidden transition"
                style={{
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.08)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  className="flex items-center justify-between p-4"
                  style={{
                    background: "rgba(255,255,255,.03)",
                    borderBottom: "1px solid rgba(255,255,255,.06)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-[44px] h-[44px] rounded-xl flex items-center justify-center text-[22px]"
                      style={{ background: ICON_COLORS[index % ICON_COLORS.length] }}
                    >
                      {ICON_EMOJIS[index % ICON_EMOJIS.length]}
                    </div>
                    <div>
                      <div className="text-[16px] font-extrabold">{assignment.group_name}</div>
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: "rgba(255,255,255,.4)" }}
                      >
                        📅 {formatDisplayDate(assignment.group_event_date)}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[14px] font-extrabold text-white"
                    style={{
                      background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                      boxShadow: "0 4px 16px rgba(251,191,36,.3)",
                    }}
                  >
                    🎁→ {assignment.receiver_nickname}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p
                      className="text-[14px] font-extrabold"
                      style={{ color: "rgba(255,255,255,.7)" }}
                    >
                      🎅 {assignment.receiver_nickname}&apos;s wishlist
                    </p>
                    <span
                      className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,.08)",
                        color: "rgba(255,255,255,.4)",
                      }}
                    >
                      {assignment.receiver_wishlist.length} item
                      {assignment.receiver_wishlist.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {assignment.receiver_wishlist.length === 0 ? (
                    <div
                      className="text-center py-5 rounded-xl"
                      style={{
                        color: "rgba(255,255,255,.2)",
                        border: "1px dashed rgba(255,255,255,.08)",
                      }}
                    >
                      No wishlist items yet 😢
                      <br />
                      <span className="text-[11px]" style={{ opacity: 0.6 }}>
                        {assignment.receiver_nickname} hasn&apos;t added any gift ideas
                      </span>
                    </div>
                  ) : (
                    assignment.receiver_wishlist.map((item) => {
                      const safeItemLink = normalizeOptionalUrl(item.item_link);

                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-xl mb-2 transition"
                          style={{
                            background: "rgba(255,255,255,.04)",
                            border: "1px solid rgba(255,255,255,.06)",
                          }}
                        >
                          <span className="text-[16px]">
                            {item.priority > 0 ? "⭐" : "🎁"}
                          </span>
                          <div className="flex-1">
                            <div
                              className="text-[14px] font-bold"
                              style={{ color: "rgba(255,255,255,.9)" }}
                            >
                              {item.item_name}
                            </div>
                            {item.item_note && (
                              <div
                                className="text-[12px] mt-0.5"
                                style={{ color: "rgba(255,255,255,.45)" }}
                              >
                                {item.item_note}
                              </div>
                            )}
                            {safeItemLink && (
                              <a
                                href={safeItemLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={safeItemLink}
                                className="text-[11px] font-semibold mt-0.5 inline-block"
                                style={{ color: "#fbbf24" }}
                              >
                                🔗{" "}
                                {safeItemLink.length > 35
                                  ? `${safeItemLink.slice(0, 35)}...`
                                  : safeItemLink}
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Gift confirmation reflects whether the user has marked their received gift as delivered. */}
                  <div
                    className="rounded-xl p-3.5 mt-3 flex items-center justify-between"
                    style={{
                      background: assignment.gift_received
                        ? "rgba(34,197,94,.06)"
                        : "rgba(251,191,36,.06)",
                      border: `1px solid ${
                        assignment.gift_received
                          ? "rgba(34,197,94,.12)"
                          : "rgba(251,191,36,.12)"
                      }`,
                    }}
                  >
                    <div>
                      <div
                        className="text-[13px] font-extrabold"
                        style={{
                          color: assignment.gift_received ? "#22c55e" : "#fbbf24",
                        }}
                      >
                        {assignment.gift_received
                          ? "✅ Gift Received!"
                          : "🎁 Did you receive your gift?"}
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ color: "rgba(255,255,255,.35)" }}
                      >
                        {assignment.gift_received
                          ? `Confirmed on ${formatDisplayDate(
                              assignment.gift_received_at
                            )}`
                          : "Your Secret Santa bought you something. Confirm when you get it."}
                      </div>
                    </div>
                    {assignment.gift_received ? (
                      <div
                        className="px-4 py-2 rounded-xl text-[12px] font-bold"
                        style={{
                          background: "rgba(34,197,94,.1)",
                          color: "#22c55e",
                        }}
                      >
                        ✅ Confirmed
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleConfirmGift(assignment.group_id)}
                        disabled={confirmingGroup === assignment.group_id}
                        className="px-4 py-2 rounded-xl text-[12px] font-extrabold text-white transition"
                        style={{
                          background: "linear-gradient(135deg,#22c55e,#16a34a)",
                          boxShadow: "0 3px 12px rgba(34,197,94,.3)",
                          border: "none",
                          cursor:
                            confirmingGroup === assignment.group_id ? "wait" : "pointer",
                          fontFamily: "inherit",
                          opacity: confirmingGroup === assignment.group_id ? 0.75 : 1,
                        }}
                      >
                        {confirmingGroup === assignment.group_id
                          ? "Confirming..."
                          : "✅ I got my gift!"}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/group/${assignment.group_id}`)}
                    className="w-full text-center py-2.5 mt-3 rounded-lg text-[12px] font-bold transition"
                    style={{
                      color: "#fbbf24",
                      background: "rgba(251,191,36,.06)",
                      border: "1px solid rgba(251,191,36,.1)",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    View group →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* The user's own wishlist is managed independently from recipient assignments. */}
        <div
          className="rounded-[18px] overflow-hidden"
          style={{
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.08)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="flex items-center justify-between p-4"
            style={{
              background: "rgba(255,255,255,.03)",
              borderBottom: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-[38px] h-[38px] rounded-lg flex items-center justify-center text-[18px]"
                style={{ background: "rgba(220,38,38,.15)" }}
              >
                📝
              </div>
              <div>
                <div
                  className="text-[16px] font-extrabold"
                  style={{ color: "rgba(255,255,255,.85)" }}
                >
                  My Wishlist
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,.4)" }}
                >
                  Your Secret Santa sees these items
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd((current) => !current)}
              disabled={availableGroups.length === 0}
              className="px-4 py-2 rounded-lg text-[12px] font-bold text-white transition"
              style={{
                background: "linear-gradient(135deg,#dc2626,#ef4444)",
                boxShadow: "0 2px 12px rgba(220,38,38,.25)",
                border: "none",
                cursor: availableGroups.length === 0 ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: availableGroups.length === 0 ? 0.6 : 1,
              }}
            >
              + Add Item
            </button>
          </div>

          <div className="p-4">
            {/* The add form keeps client-side input well shaped before calling server actions. */}
            {showAdd && (
              <div
                className="rounded-xl p-4 mb-4"
                style={{
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                }}
              >
                {availableGroups.length > 1 && (
                  <div className="mb-3">
                    <p
                      className="text-[10px] font-bold mb-1.5"
                      style={{ color: "rgba(255,255,255,.35)" }}
                    >
                      Add to which group?
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableGroups.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => setAddGroupId(group.id)}
                          className="text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition"
                          style={{
                            background:
                              addGroupId === group.id
                                ? "rgba(220,38,38,.2)"
                                : "rgba(255,255,255,.04)",
                            color:
                              addGroupId === group.id
                                ? "#fca5a5"
                                : "rgba(255,255,255,.5)",
                            border: `1px solid ${
                              addGroupId === group.id
                                ? "rgba(220,38,38,.3)"
                                : "rgba(255,255,255,.08)"
                            }`,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {group.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <input
                  value={addName}
                  onChange={(event) => setAddName(event.target.value)}
                  maxLength={ITEM_NAME_MAX_LENGTH}
                  placeholder="Item name (e.g. Nintendo Switch)..."
                  className="w-full mb-2 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.1)",
                    color: "#fff",
                    fontFamily: "inherit",
                  }}
                />

                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    inputMode="url"
                    value={addLink}
                    onChange={(event) => setAddLink(event.target.value)}
                    maxLength={ITEM_LINK_MAX_LENGTH}
                    placeholder="Link (optional)..."
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: "rgba(255,255,255,.05)",
                      border: "1px solid rgba(255,255,255,.1)",
                      color: "#fff",
                      fontFamily: "inherit",
                    }}
                  />
                  <input
                    value={addNote}
                    onChange={(event) => setAddNote(event.target.value)}
                    maxLength={ITEM_NOTE_MAX_LENGTH}
                    placeholder="Note (optional)..."
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: "rgba(255,255,255,.05)",
                      border: "1px solid rgba(255,255,255,.1)",
                      color: "#fff",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label
                    className="flex items-center gap-2 text-[11px] font-bold"
                    style={{ color: "rgba(255,255,255,.4)" }}
                  >
                    <input
                      type="checkbox"
                      checked={addPriority > 0}
                      onChange={(event) => setAddPriority(event.target.checked ? 1 : 0)}
                      style={{ accentColor: "#fbbf24" }}
                    />
                    ⭐ Top priority
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAdd(false)}
                      className="px-4 py-2 rounded-lg text-[11px] font-bold"
                      style={{
                        background: "rgba(255,255,255,.08)",
                        color: "rgba(255,255,255,.5)",
                        border: "none",
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={addLoading}
                      className="px-4 py-2 rounded-lg text-[11px] font-bold text-white"
                      style={{
                        background: "#22c55e",
                        border: "none",
                        fontFamily: "inherit",
                        cursor: addLoading ? "wait" : "pointer",
                        opacity: addLoading ? 0.75 : 1,
                      }}
                    >
                      {addLoading ? "Saving..." : "✅ Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {myItems.length === 0 ? (
              <div
                className="text-center py-6 rounded-xl"
                style={{
                  color: "rgba(255,255,255,.2)",
                  border: "1px dashed rgba(255,255,255,.08)",
                }}
              >
                No items yet — add your first gift idea!
              </div>
            ) : (
              myItems.map((item) => (
                <div key={item.id}>
                  {editingId === item.id ? (
                    <div
                      className="rounded-xl p-3.5 mb-2"
                      style={{
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(59,130,246,.2)",
                      }}
                    >
                      <input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        maxLength={ITEM_NAME_MAX_LENGTH}
                        className="w-full mb-2 px-3 py-2 rounded-lg text-[13px] outline-none"
                        style={{
                          background: "rgba(255,255,255,.05)",
                          border: "1px solid rgba(255,255,255,.1)",
                          color: "#fff",
                          fontFamily: "inherit",
                        }}
                      />
                      <div className="flex gap-2 mb-2">
                        <input
                          type="url"
                          inputMode="url"
                          value={editLink}
                          onChange={(event) => setEditLink(event.target.value)}
                          maxLength={ITEM_LINK_MAX_LENGTH}
                          placeholder="Link..."
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: "rgba(255,255,255,.05)",
                            border: "1px solid rgba(255,255,255,.1)",
                            color: "#fff",
                            fontFamily: "inherit",
                          }}
                        />
                        <input
                          value={editNote}
                          onChange={(event) => setEditNote(event.target.value)}
                          maxLength={ITEM_NOTE_MAX_LENGTH}
                          placeholder="Note..."
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: "rgba(255,255,255,.05)",
                            border: "1px solid rgba(255,255,255,.1)",
                            color: "#fff",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <label
                        className="flex items-center gap-2 text-[11px] font-bold mb-3"
                        style={{ color: "rgba(255,255,255,.4)" }}
                      >
                        <input
                          type="checkbox"
                          checked={editPriority > 0}
                          onChange={(event) => setEditPriority(event.target.checked ? 1 : 0)}
                          style={{ accentColor: "#fbbf24" }}
                        />
                        ⭐ Top priority
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                          style={{
                            background: "rgba(255,255,255,.08)",
                            color: "rgba(255,255,255,.5)",
                            border: "none",
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(item.id)}
                          disabled={editLoadingId === item.id}
                          className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white"
                          style={{
                            background: "#22c55e",
                            border: "none",
                            fontFamily: "inherit",
                            cursor: editLoadingId === item.id ? "wait" : "pointer",
                            opacity: editLoadingId === item.id ? 0.75 : 1,
                          }}
                        >
                          {editLoadingId === item.id ? "Saving..." : "✅ Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-3 rounded-xl mb-2 transition"
                      style={{
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <div className="flex-1">
                        <div
                          className="text-[13px] font-bold"
                          style={{ color: "rgba(255,255,255,.85)" }}
                        >
                          {item.priority > 0 ? "⭐ " : ""}
                          {item.item_name}
                        </div>
                        {item.item_note && (
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: "rgba(255,255,255,.4)" }}
                          >
                            {item.item_note}
                          </div>
                        )}
                        <div
                          className="text-[9px] font-bold mt-1 inline-block px-2 py-0.5 rounded"
                          style={{
                            color: "rgba(255,255,255,.25)",
                            background: "rgba(255,255,255,.04)",
                          }}
                        >
                          {getGroupName(item.group_id)}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                          style={{
                            background: "rgba(59,130,246,.12)",
                            color: "#93c5fd",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleteLoadingId === item.id}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                          style={{
                            background: "rgba(220,38,38,.12)",
                            color: "#fca5a5",
                            border: "none",
                            cursor: deleteLoadingId === item.id ? "wait" : "pointer",
                            fontFamily: "inherit",
                            opacity: deleteLoadingId === item.id ? 0.75 : 1,
                          }}
                        >
                          {deleteLoadingId === item.id ? "..." : "🗑️"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <SnowEffect />
    </main>
  );
}

function SnowEffect() {
  useEffect(() => {
    const snowWrapper = document.getElementById("snowWrap");

    if (snowWrapper && snowWrapper.children.length === 0) {
      // Use a fragment so all snowflakes are appended in a single DOM write.
      const fragment = document.createDocumentFragment();

      for (let index = 0; index < 50; index += 1) {
        const snowflake = document.createElement("div");
        const size = 2 + Math.random() * 3;

        snowflake.className = "snowflake";
        snowflake.style.cssText = [
          `width:${size}px`,
          `height:${size}px`,
          `left:${Math.random() * 100}%`,
          `animation-duration:${5 + Math.random() * 10}s`,
          `animation-delay:${Math.random() * 6}s`,
          `opacity:${0.2 + Math.random() * 0.3}`,
        ].join(";");

        fragment.appendChild(snowflake);
      }

      snowWrapper.appendChild(fragment);
    }

    // replaceChildren avoids parsing an empty HTML string and directly clears the container.
    return () => {
      const currentWrapper = document.getElementById("snowWrap");
      currentWrapper?.replaceChildren();
    };
  }, []);

  return null;
}
