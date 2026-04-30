"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardSkeleton } from "@/app/components/PageSkeleton";
import {
  enhanceDashboardGroupsWithPeerProfiles,
  loadDashboardGroups,
  splitDashboardGroups,
} from "@/app/dashboard/dashboard-groups-data";
import type { Group } from "@/app/dashboard/dashboard-types";
import { HistoryGroupCard } from "@/app/history/HistoryGroupCard";
import { isGroupInHistory } from "@/lib/groups/history";
import { createClient } from "@/lib/supabase/client";

type HistoryPageUser = {
  id: string;
  email?: string | null;
};

function filterHistoryGroups(groups: Group[]) {
  return splitDashboardGroups(groups.filter((group) => isGroupInHistory(group.event_date)));
}

export default function HistoryPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const mountedRef = useRef(false);
  const loadVersionRef = useRef(0);
  const sessionUserRef = useRef<HistoryPageUser | null>(null);

  const loadHistoryGroups = useCallback(
    async (user: HistoryPageUser) => {
      const loadVersion = ++loadVersionRef.current;

      try {
        const groups = await loadDashboardGroups(supabase, user);

        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        const historical = filterHistoryGroups(groups.allGroups);
        setOwnedGroups(historical.ownedGroups);
        setInvitedGroups(historical.invitedGroups);
        setLoading(false);

        const enhancedGroups = await enhanceDashboardGroupsWithPeerProfiles(historical.allGroups);

        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        const enhanced = filterHistoryGroups(enhancedGroups);
        setOwnedGroups(enhanced.ownedGroups);
        setInvitedGroups(enhanced.invitedGroups);
      } catch {
        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        setMessage("Failed to load your history. Please refresh and try again.");
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    mountedRef.current = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        const sessionUser = sessionUserRef.current;
        if (sessionUser) {
          void loadHistoryGroups(sessionUser);
        }
      }, 120);
    };

    const bootstrap = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        sessionUserRef.current = { email: user.email, id: user.id };
        await loadHistoryGroups(sessionUserRef.current);
      } catch {
        if (!mountedRef.current) {
          return;
        }

        setMessage("Failed to load your history. Please refresh and try again.");
        setLoading(false);
      }
    };

    void bootstrap();

    const channel = supabase
      .channel("history-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, scheduleReload)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        scheduleReload
      )
      .subscribe();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
        return;
      }

      sessionUserRef.current = { email: session.user.email, id: session.user.id };
      scheduleReload();
    });

    return () => {
      mountedRef.current = false;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      void supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [loadHistoryGroups, router, supabase]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const allHistoryGroups = [...ownedGroups, ...invitedGroups];

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {message && (
          <p role="status" className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {message}
          </p>
        )}

        <section className="mb-7 rounded-[30px] border border-[rgba(72,102,78,.12)] bg-white/82 p-6 shadow-[0_18px_44px_rgba(46,52,50,.05)]">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7b5902]">
            Event history
          </p>
          <h1 className="mt-2 text-[34px] font-black leading-tight text-[#48664e]">
            Past exchanges
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] font-semibold leading-7 text-slate-600">
            Exchanges move here after their gift day and a short wrap-up window.
            Active groups stay focused on current wishlists, shopping ideas, and gift progress.
          </p>
        </section>

        {allHistoryGroups.length === 0 ? (
          <section className="rounded-[28px] border border-dashed border-[rgba(72,102,78,.24)] bg-white/72 p-8 text-center">
            <h2 className="text-[22px] font-black text-[#2e3432]">No concluded exchanges yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-600">
              Past groups will appear here automatically after the wrap-up window ends.
            </p>
          </section>
        ) : (
          <div className="space-y-8">
            {ownedGroups.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3 px-2">
                  <h2 className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                    Hosted by you
                  </h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                    {ownedGroups.length} group{ownedGroups.length === 1 ? "" : "s"}
                  </span>
                </div>
                {ownedGroups.map((group) => (
                  <HistoryGroupCard
                    key={`owned-${group.id}`}
                    group={group}
                    onOpenGroup={(groupId) => router.push(`/group/${groupId}`)}
                  />
                ))}
              </section>
            )}

            {invitedGroups.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3 px-2">
                  <h2 className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                    Joined as member
                  </h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                    {invitedGroups.length} group{invitedGroups.length === 1 ? "" : "s"}
                  </span>
                </div>
                {invitedGroups.map((group) => (
                  <HistoryGroupCard
                    key={`joined-${group.id}`}
                    group={group}
                    onOpenGroup={(groupId) => router.push(`/group/${groupId}`)}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
