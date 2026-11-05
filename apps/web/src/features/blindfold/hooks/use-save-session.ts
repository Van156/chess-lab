import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/app/orpc";

import type { DrillSession } from "../lib/drill-session";
import { sessionSummary } from "../lib/drill-session";
import { bestAccuracyFor } from "../lib/drill-stats";

export type SaveStatus = "saving" | "saved" | "error";

/**
 * Saves a finished drill through `blindfold.recordSession` and refreshes the progress stats.
 * `save` is called once from the event that ends the session; `retry` repeats the last save
 * after a failure. `previousBest` is the drill's best accuracy read from the cached stats just
 * before saving (null when never played, undefined when the stats were not loaded), so the
 * results screen can tell a new personal best.
 */
export function useSaveSession() {
  const queryClient = useQueryClient();
  const [previousBest, setPreviousBest] = useState<number | null | undefined>(undefined);
  const mutation = useMutation({
    ...orpc.blindfold.recordSession.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.blindfold.stats.key() }),
  });

  function save(session: DrillSession) {
    const stats = queryClient.getQueryData(orpc.blindfold.stats.queryKey());
    setPreviousBest(stats ? bestAccuracyFor(stats, session.kind) : undefined);
    mutation.mutate({ drill: session.kind, level: session.level, ...sessionSummary(session) });
  }

  const status: SaveStatus | null = mutation.isPending
    ? "saving"
    : mutation.isError
      ? "error"
      : mutation.isSuccess
        ? "saved"
        : null;

  return {
    status,
    save,
    previousBest,
    /** Repeats the failed save with the same input. */
    retry: () => {
      if (mutation.variables) mutation.mutate(mutation.variables);
    },
  };
}
