"use client";

import { useEffect, useRef } from "react";
import type {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

type RealtimeEvent = "*" | "INSERT" | "UPDATE" | "DELETE";
type RealtimeRow = Record<string, unknown>;
type RealtimePayload = RealtimePostgresChangesPayload<RealtimeRow>;

export type RealtimeRefreshRule = {
  event?: RealtimeEvent;
  filter?: string;
  schema?: string;
  table: string;
  shouldRefresh?: (payload: RealtimePayload) => boolean;
};

type UseSupabaseRealtimeRefreshOptions = {
  channelName: string;
  debounceMs?: number;
  enabled?: boolean;
  onRefresh: () => Promise<void> | void;
  pollMs?: number;
  refreshOnFocus?: boolean;
  rules: readonly RealtimeRefreshRule[];
  supabase: SupabaseClient;
};

function readPayloadRecordValue(payload: RealtimePayload, recordKey: "new" | "old", field: string) {
  const record = payload[recordKey] as RealtimeRow | null | undefined;
  const value = record?.[field];

  return typeof value === "string" ? value : null;
}

export function realtimePayloadMatchesValue(
  payload: RealtimePayload,
  field: string,
  value: string,
  { refreshWhenUnknown = false }: { refreshWhenUnknown?: boolean } = {}
) {
  const nextValue = readPayloadRecordValue(payload, "new", field);
  const previousValue = readPayloadRecordValue(payload, "old", field);

  if (!nextValue && !previousValue) {
    return refreshWhenUnknown;
  }

  return nextValue === value || previousValue === value;
}

export function realtimePayloadMatchesAnyValue(
  payload: RealtimePayload,
  field: string,
  values: ReadonlySet<string>,
  { refreshWhenUnknown = false }: { refreshWhenUnknown?: boolean } = {}
) {
  const nextValue = readPayloadRecordValue(payload, "new", field);
  const previousValue = readPayloadRecordValue(payload, "old", field);

  if (!nextValue && !previousValue) {
    return refreshWhenUnknown;
  }

  return (
    (nextValue ? values.has(nextValue) : false) ||
    (previousValue ? values.has(previousValue) : false)
  );
}

export function useSupabaseRealtimeRefresh({
  channelName,
  debounceMs = 120,
  enabled = true,
  onRefresh,
  pollMs = 0,
  refreshOnFocus = true,
  rules,
  supabase,
}: UseSupabaseRealtimeRefreshOptions) {
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || rules.length === 0) {
      return;
    }

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let channel = supabase.channel(channelName);

    const scheduleRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        void onRefreshRef.current();
      }, debounceMs);
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };

    for (const rule of rules) {
      const filter = {
        event: rule.event || "*",
        schema: rule.schema || "public",
        table: rule.table,
        ...(rule.filter ? { filter: rule.filter } : {}),
      } as const;

      channel = channel.on("postgres_changes", filter, (payload) => {
        if (rule.shouldRefresh && !rule.shouldRefresh(payload as RealtimePayload)) {
          return;
        }

        scheduleRefresh();
      });
    }

    void channel.subscribe();

    if (refreshOnFocus) {
      window.addEventListener("focus", refreshIfVisible);
      document.addEventListener("visibilitychange", refreshIfVisible);
    }

    if (pollMs > 0) {
      pollInterval = setInterval(refreshIfVisible, pollMs);
    }

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      if (pollInterval) {
        clearInterval(pollInterval);
      }

      if (refreshOnFocus) {
        window.removeEventListener("focus", refreshIfVisible);
        document.removeEventListener("visibilitychange", refreshIfVisible);
      }

      void supabase.removeChannel(channel);
    };
  }, [channelName, debounceMs, enabled, pollMs, refreshOnFocus, rules, supabase]);
}
