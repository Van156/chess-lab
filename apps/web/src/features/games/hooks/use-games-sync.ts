import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { orpc } from "@/app/orpc";
import { shouldRefreshSummary, syncPollInterval, useNow } from "@/features/today";

/**
 * Lichess sync status and "Sync now" for the Games screen. It reads the same `lichess.status`
 * query as Today (shared cache, same polling while a sync is in flight) and reloads the games
 * list, plus Today's counts, when a sync finished or imported something.
 */
export function useGamesSync() {
  const queryClient = useQueryClient();
  const status = useQuery({
    ...orpc.lichess.status.queryOptions(),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => syncPollInterval(query.state.data, Date.now()),
  });
  const syncNow = useMutation({
    ...orpc.lichess.sync.mutationOptions(),
    onSuccess: (next) => queryClient.setQueryData(orpc.lichess.status.queryKey(), next),
    // The request may have reached the server before it failed: show what the server says.
    onError: () => void queryClient.invalidateQueries({ queryKey: orpc.lichess.status.queryKey() }),
  });

  const now = useNow();
  const observed = status.data;
  const previous = useRef(observed);
  useEffect(() => {
    if (shouldRefreshSummary(previous.current, observed)) {
      void queryClient.invalidateQueries({ queryKey: orpc.games.list.key() });
      void queryClient.invalidateQueries({ queryKey: orpc.today.summary.key() });
    }
    previous.current = observed ?? previous.current;
  }, [observed, queryClient]);

  return {
    status: status.data,
    now,
    syncNow: () => syncNow.mutate(undefined),
    syncPending: syncNow.isPending,
    /** The last "Sync now" request failed; cleared by the next attempt. */
    syncFailed: syncNow.isError,
  };
}
