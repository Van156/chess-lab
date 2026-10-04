import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { orpc } from "@/app/orpc";

import type { SyncStatus } from "../lib/today-types";

/** While an import is running or backing off, re-read its status this often. */
const SYNC_POLL_MS = 5000;

const isInFlight = (state: SyncStatus["state"] | undefined) =>
  state === "running" || state === "backoff";

/**
 * Data and actions behind Today. `lichess.status` owns the auto-sync (it enqueues one when the
 * last import is stale), so the screen calls it once on mount and then polls it while a sync is in
 * flight; `lichess.sync` is the manual "Sync now" (the only retry for a failed import). When a
 * sync finishes the summary is refetched, because new games change what is due.
 */
export function useToday() {
  const queryClient = useQueryClient();
  const summary = useQuery(orpc.today.summary.queryOptions());
  const status = useQuery({
    ...orpc.lichess.status.queryOptions(),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (isInFlight(query.state.data?.state) ? SYNC_POLL_MS : false),
  });
  const syncNow = useMutation({
    ...orpc.lichess.sync.mutationOptions(),
    onSuccess: (next) => queryClient.setQueryData(orpc.lichess.status.queryKey(), next),
  });

  const state = status.data?.state;
  const previous = useRef(state);
  useEffect(() => {
    if (previous.current === "running" && state !== "running") {
      void queryClient.invalidateQueries({ queryKey: orpc.today.summary.key() });
    }
    previous.current = state;
  }, [state, queryClient]);

  function prefetchReview() {
    void queryClient.prefetchQuery(orpc.review.queue.queryOptions({ input: {} }));
  }

  return {
    data: summary.data ? { ...summary.data, sync: status.data ?? summary.data.sync } : undefined,
    now: Math.max(summary.dataUpdatedAt, status.dataUpdatedAt),
    isPending: summary.isPending,
    error: summary.error,
    retry: () => void summary.refetch(),
    syncNow: () => syncNow.mutate(undefined),
    syncPending: syncNow.isPending,
    prefetchReview,
  };
}
