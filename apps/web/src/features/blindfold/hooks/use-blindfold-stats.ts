import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

/** Per-drill progress (sessions, best accuracy, recent sessions) for the signed-in user. */
export function useBlindfoldStats() {
  const stats = useQuery(orpc.blindfold.stats.queryOptions());
  return {
    data: stats.data,
    isPending: stats.isPending,
    retry: () => void stats.refetch(),
  };
}
