import type { RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";

/** One move of the variation tree, with everything the outline needs to draw and select it. */
export type TreeNode = {
  moveId: string;
  san: string;
  /** Move-numbered SAN: "1. e4" for White, "1... e5" for Black. */
  label: string;
  /** "you" for the repertoire owner's moves, "reply" for the opponent's. */
  side: "you" | "reply";
  positionId: string;
  /** Move ids from the start position to this move. */
  route: string[];
  /** 1-based: 1 is White's first move. */
  ply: number;
  /** The move is on the line being shown. */
  onPath: boolean;
  /** The move is the last one of the line being shown. */
  isCurrent: boolean;
  /** The position was already expanded elsewhere, so this move ends its line and points back. */
  transposition: boolean;
  /**
   * The other moves played from the same position as this one, each starting a line of its own.
   * Only the move that continues the sequence carries them, so they read as alternatives to it.
   */
  alternatives: TreeLine[];
};

/** A flat run of moves. Alternatives are marked and nested one level deeper than their parent. */
export type TreeLine = {
  /** 0 for the main line, one more for every level of alternative. */
  depth: number;
  isAlternative: boolean;
  nodes: TreeNode[];
};

/**
 * The repertoire graph from the start position as a tree for an outline. A chain of only-children
 * is one flat line. At a fork the first stored move continues the line and every other move starts
 * an alternative, attached to the move it is an alternative to. The main line is claimed first, so
 * a position is expanded where it is first reached and any later arrival is a leaf flagged
 * `transposition`; the result has neither cycles nor duplicated subtrees.
 *
 * With a `base` (the moves from the start to a base position) the tree is rooted there and shows
 * only what follows it. Routes stay whole, from the start, so selecting a node works unchanged and
 * the plies and labels stay right.
 *
 * It depends on the graph, the current path and the base only, never on engine data, so callers can
 * memoise it on those inputs.
 */
export function buildVariationTree(
  graph: RepertoireGraph,
  path: readonly RepertoireMove[],
  base: readonly RepertoireMove[] = [],
): TreeLine {
  const rootId = base.at(-1)?.toPositionId ?? graph.startPositionId;
  const rootRoute = base.map((move) => move.id);
  const byParent = new Map<string, RepertoireMove[]>();
  for (const move of graph.moves) {
    const siblings = byParent.get(move.fromPositionId);
    if (siblings) siblings.push(move);
    else byParent.set(move.fromPositionId, [move]);
  }

  const onPath = new Set(path.map((move) => move.id));
  const currentId = path.at(-1)?.id ?? null;
  const expanded = new Set([rootId]);

  const buildNode = (move: RepertoireMove, parentRoute: string[]): TreeNode => {
    const route = [...parentRoute, move.id];
    const ply = route.length;
    const transposition = expanded.has(move.toPositionId);
    expanded.add(move.toPositionId);
    return {
      moveId: move.id,
      san: move.san,
      label: `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "..."} ${move.san}`,
      side: move.isUserMove ? "you" : "reply",
      positionId: move.toPositionId,
      route,
      ply,
      onPath: onPath.has(move.id),
      isCurrent: move.id === currentId,
      transposition,
      alternatives: [],
    };
  };

  const buildLine = (
    first: RepertoireMove,
    parentRoute: string[],
    depth: number,
    firstOthers: RepertoireMove[] = [],
  ): TreeLine => {
    const nodes: TreeNode[] = [];
    const forks: { node: TreeNode; others: RepertoireMove[] }[] = [];
    let next: { move: RepertoireMove; others: RepertoireMove[] } | undefined = {
      move: first,
      others: firstOthers,
    };

    // Walk the whole chain before opening any alternative, so the main line claims its positions.
    for (let route = parentRoute; next;) {
      const node = buildNode(next.move, route);
      nodes.push(node);
      if (next.others.length > 0) forks.push({ node, others: next.others });
      route = node.route;

      const [following, ...others] = node.transposition
        ? []
        : (byParent.get(node.positionId) ?? []);
      next = following && { move: following, others };
    }

    for (const { node, others } of forks) {
      const forkRoute = node.route.slice(0, -1);
      node.alternatives = others.map((move) => buildLine(move, forkRoute, depth + 1));
    }
    return { depth, isAlternative: depth > 0, nodes };
  };

  const [first, ...others] = byParent.get(rootId) ?? [];
  if (!first) return { depth: 0, isAlternative: false, nodes: [] };

  return buildLine(first, rootRoute, 0, others);
}
