import type { ExplorerData } from "./repertoire-types";

/** What the container knows: still loading, the request itself failed, or an answer. */
export type ExplorerPanelState =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "loaded"; data: ExplorerData };

/**
 * Maps the explorer query to what the panel shows. Data wins over an error, so a failed background
 * refetch keeps the stats on screen; a disabled or pending query is loading.
 */
export function toExplorerPanelState(query: {
  data: ExplorerData | undefined;
  isError: boolean;
}): ExplorerPanelState {
  if (query.data) return { kind: "loaded", data: query.data };
  if (query.isError) return { kind: "failed" };
  return { kind: "loading" };
}
