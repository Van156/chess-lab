import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

/** All-time practice (sessions, time, accuracy, streak and practice days) for the signed-in user. */
export function useBlindfoldSummary() {
  const summary = useQuery(orpc.blindfold.summary.queryOptions());
  return {
    data: summary.data,
    isPending: summary.isPending,
    retry: () => void summary.refetch(),
  };
}
