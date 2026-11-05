import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

import type { DrillStat } from "../lib/drill-stats";

/** Per-drill progress (sessions, best accuracy, recent sessions, last played) for the signed-in user. */
export function useBlindfoldStats() {
  const stats = useQuery(orpc.blindfold.stats.queryOptions());
  const data: readonly DrillStat[] | undefined = stats.data;
  return {
    data,
    isPending: stats.isPending,
    retry: () => void stats.refetch(),
  };
}
