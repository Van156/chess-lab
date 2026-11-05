import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

import { toExplorerPanelState, type ExplorerPanelState } from "../lib/explorer-state";

const EXPLORER_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Explorer stats for one position of a repertoire. The server already retries and caches, so the
 * client does not retry. There is no placeholder from the previous position: stats of another
 * position would mislead. A failed request is reported as `failed`, never thrown into the page.
 */
export function useExplorer(repertoireId: string, positionId: string): ExplorerPanelState {
  const query = useQuery({
    ...orpc.repertoire.explorer.queryOptions({ input: { repertoireId, positionId } }),
    enabled: repertoireId !== "" && positionId !== "",
    retry: false,
    staleTime: EXPLORER_STALE_TIME_MS,
  });
  return toExplorerPanelState(query);
}
