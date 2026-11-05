import { formatLine, pathTo, type RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";

/**
 * The moves of the shortest route from the start position to the base position. Empty when no base
 * is set, when the base is the start position or when the graph no longer reaches it, so the caller
 * treats all three as "no base".
 */
export function baseLine(graph: RepertoireGraph, basePositionId: string | null): RepertoireMove[] {
  return basePositionId === null ? [] : (pathTo(graph, basePositionId) ?? []);
}

/** The tree header: the base in move-pair notation, or "Start position" when there is none. */
export function baseHeading(line: readonly RepertoireMove[]): string {
  return line.length === 0 ? "Start position" : `Base: ${formatLine(line)}`;
}

/** Any position can become the base except the start (that is "no base") and the current base. */
export function canSetBase(
  currentPositionId: string,
  startPositionId: string,
  basePositionId: string | null,
): boolean {
  return currentPositionId !== startPositionId && currentPositionId !== basePositionId;
}

/**
 * How many plies of `path` lead to the base position, or null when there is no base or the line
 * does not pass through it. Works on the route actually taken, so a base reached by transposition
 * is found where the line reaches it, not where the shortest route would.
 */
export function basePly(
  path: readonly RepertoireMove[],
  basePositionId: string | null,
): number | null {
  if (basePositionId === null) return null;
  const index = path.findIndex((move) => move.toPositionId === basePositionId);
  return index === -1 ? null : index + 1;
}
