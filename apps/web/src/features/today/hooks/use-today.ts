import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { orpc } from "@/app/orpc";

import { shouldRefreshSummary, syncPollInterval } from "../lib/sync-schedule";
import { useNow } from "./use-now";

/**
 * Data and actions behind Today. `lichess.status` owns the auto-sync (it enqueues one when the
 * last import is stale), so the screen calls it once on mount and then polls it while a sync is in
 * flight; `lichess.sync` is the manual "Sync now" (the only retry for a failed import). The summary
 * is refetched whenever the observed sync result can change counts (see `shouldRefreshSummary`).
 * `now` is a live clock, so relative times keep ticking between fetches. `sync` falls back to the
 * summary's copy and is `null` when both reads failed; the view renders "Sync status unavailable".
 */
export function useToday() {
  const queryClient = useQueryClient();
  const summary = useQuery(orpc.today.summary.queryOptions());
  const status = useQuery({
    ...orpc.lichess.status.queryOptions(),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => syncPollInterval(query.state.data, Date.now()),
  });
  const syncNow = useMutation({
    ...orpc.lichess.sync.mutationOptions(),
    onSuccess: (next) => queryClient.setQueryData(orpc.lichess.status.queryKey(), next),
  });

  const now = useNow();
  const observed = status.data;
  const previous = useRef(observed);
  useEffect(() => {
    if (shouldRefreshSummary(previous.current, observed)) {
      void queryClient.invalidateQueries({ queryKey: orpc.today.summary.key() });
    }
    previous.current = observed ?? previous.current;
  }, [observed, queryClient]);

  function prefetchReview() {
    void queryClient.prefetchQuery(orpc.review.queue.queryOptions({ input: {} }));
  }

  return {
    data: summary.data ? { ...summary.data, sync: status.data ?? summary.data.sync } : undefined,
    now,
    isPending: summary.isPending,
    retry: () => void summary.refetch(),
    syncNow: () => syncNow.mutate(undefined),
    syncPending: syncNow.isPending,
    prefetchReview,
  };
}
