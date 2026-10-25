import { pathTo, type RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";

/** How many deletions can be undone; the oldest snapshot is dropped past this. */
export const MAX_UNDO_ENTRIES = 20;

/** Pushes `entry` as the newest, dropping the oldest ones beyond the cap. */
export function pushEntry<T extends { id: string }>(stack: readonly T[], entry: T): T[] {
  return [...stack, entry].slice(-MAX_UNDO_ENTRIES);
}

/** The most recent entry, which Ctrl/Cmd+Z restores. */
export function newestEntry<T>(stack: readonly T[]): T | undefined {
  return stack.at(-1);
}

export function findEntry<T extends { id: string }>(
  stack: readonly T[],
  id: string,
): T | undefined {
  return stack.find((entry) => entry.id === id);
}

/** The stack without `id`, wherever it sits; the others keep their order. */
export function removeEntry<T extends { id: string }>(stack: readonly T[], id: string): T[] {
  return stack.filter((entry) => entry.id !== id);
}

/** Where the board stands once a deletion is undone: the deleted move's target and its route. */
export type RestoreTarget = { positionId: string; route: string[] };

/**
 * Where to take the board when `move` comes back: its target position, reached along `shown` (the
 * line on screen) when the move was part of it, otherwise along the shortest route. Computed from
 * the graph before the delete, so the route stays right after the restore.
 */
export function restoreTarget(
  graph: RepertoireGraph,
  move: RepertoireMove,
  shown: readonly RepertoireMove[],
): RestoreTarget {
  const at = shown.findIndex((candidate) => candidate.id === move.id);
  const lead = at >= 0 ? shown.slice(0, at) : [];
  const route =
    pathTo(
      graph,
      move.fromPositionId,
      lead.map((step) => step.id),
    ) ?? [];
  return { positionId: move.toPositionId, route: [...route.map((step) => step.id), move.id] };
}
