import { childMoves, type RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";

/** A key press, reduced to what decides whether it moves the board. */
export type TreeKeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** True when the focused control (a text field, a tab, a slider) reads the arrows for itself. */
  targetUsesArrows: boolean;
};

export type TreeKeyContext = {
  graph: RepertoireGraph;
  /** The moves from the start to the shown position, along the route taken. */
  path: readonly RepertoireMove[];
  /** The moves from the start to the base; empty when none is set. */
  baseLine: readonly RepertoireMove[];
};

/** Where a key sends the board: a position and the route of move ids that reaches it. */
export type TreeTarget = { positionId: string; route: string[] };

const targetOf = (graph: RepertoireGraph, moves: readonly RepertoireMove[]): TreeTarget => ({
  positionId: moves.at(-1)?.toPositionId ?? graph.startPositionId,
  route: moves.map((move) => move.id),
});

/**
 * The child a forward key follows: the one on the base line when there is one, otherwise the first
 * stored move, which is the main line of the variation tree.
 */
function preferredChild(
  graph: RepertoireGraph,
  positionId: string,
  baseLine: readonly RepertoireMove[],
): RepertoireMove | undefined {
  const children = childMoves(graph, positionId);
  const onBase = new Set(baseLine.map((move) => move.id));
  return children.find((move) => onBase.has(move.id)) ?? children[0];
}

/**
 * Where a key press moves the board, or null when it does nothing. ← goes to the parent along the
 * route taken, → to the preferred child, Home to the start and End down the preferred children to
 * the leaf. Keys with ctrl, meta or alt held, and keys from controls that read the arrows
 * themselves, are left alone.
 */
export function treeKeyTarget(event: TreeKeyEvent, context: TreeKeyContext): TreeTarget | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.targetUsesArrows) return null;
  const { graph, path, baseLine } = context;
  switch (event.key) {
    case "ArrowLeft":
      return path.length === 0 ? null : targetOf(graph, path.slice(0, -1));
    case "Home":
      return path.length === 0 ? null : targetOf(graph, []);
    case "ArrowRight":
    case "End": {
      const walked = [...path];
      const seen = new Set([graph.startPositionId, ...path.map((move) => move.toPositionId)]);
      let at = path.at(-1)?.toPositionId ?? graph.startPositionId;
      for (;;) {
        const child = preferredChild(graph, at, baseLine);
        if (!child || seen.has(child.toPositionId)) break;
        walked.push(child);
        seen.add(child.toPositionId);
        at = child.toPositionId;
        if (event.key === "ArrowRight") break;
      }
      return walked.length === path.length ? null : targetOf(graph, walked);
    }
    default:
      return null;
  }
}
