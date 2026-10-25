import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

import type { DrillSession } from "../lib/drill-session";
import { sessionSummary } from "../lib/drill-session";

export type SaveStatus = "saving" | "saved" | "error";

/**
 * Saves a finished drill through `blindfold.recordSession` and refreshes the progress stats.
 * `save` is called once from the event that ends the session; `retry` repeats the last save
 * after a failure.
 */
export function useSaveSession() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...orpc.blindfold.recordSession.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.blindfold.stats.key() }),
  });

  function save(session: DrillSession) {
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
    /** Repeats the failed save with the same input. */
    retry: () => {
      if (mutation.variables) mutation.mutate(mutation.variables);
    },
  };
}
