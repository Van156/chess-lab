import type { RepertoireData, RepertoireMove } from "./repertoire-types";

/** The slice of `repertoire.get` the tree helpers need. */
export type RepertoireGraph = Pick<RepertoireData, "startPositionId" | "moves">;

/** Moves played from a position, in the order the server stored them (stable across renders). */
export function childMoves(graph: RepertoireGraph, positionId: string): RepertoireMove[] {
  return graph.moves.filter((move) => move.fromPositionId === positionId);
}

/**
 * The moves from the start position to `positionId`, or null when it is not in the graph.
 * Positions can be reached by several move orders (transpositions): a `route` of move ids that
 * is a valid walk from the start ending at `positionId` is returned as is, so the line the user
 * navigated stays put; otherwise the first shortest route found is used.
 */
export function pathTo(
  graph: RepertoireGraph,
  positionId: string,
  route: readonly string[] = [],
): RepertoireMove[] | null {
  const walked = walkRoute(graph, route);
  if (walked && endOf(graph, walked) === positionId) {
    return walked;
  }

  const via = new Map<string, RepertoireMove>();
  const seen = new Set([graph.startPositionId]);
  const queue = [graph.startPositionId];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head] as string;
    if (current === positionId) {
      break;
    }
    for (const move of childMoves(graph, current)) {
      if (!seen.has(move.toPositionId)) {
        seen.add(move.toPositionId);
        via.set(move.toPositionId, move);
        queue.push(move.toPositionId);
      }
    }
  }
  if (!seen.has(positionId)) {
    return null;
  }

  const path: RepertoireMove[] = [];
  for (let at = positionId; at !== graph.startPositionId;) {
    const move = via.get(at);
    if (!move) {
      return null;
    }
    path.unshift(move);
    at = move.fromPositionId;
  }
  return path;
}

/** `route` as moves when every id exists and each one continues the previous; null otherwise. */
function walkRoute(graph: RepertoireGraph, route: readonly string[]): RepertoireMove[] | null {
  const byId = new Map(graph.moves.map((move) => [move.id, move]));
  const moves: RepertoireMove[] = [];
  let at = graph.startPositionId;
  for (const id of route) {
    const move = byId.get(id);
    if (!move || move.fromPositionId !== at) {
      return null;
    }
    moves.push(move);
    at = move.toPositionId;
  }
  return moves;
}

function endOf(graph: RepertoireGraph, moves: readonly RepertoireMove[]): string {
  return moves.at(-1)?.toPositionId ?? graph.startPositionId;
}

/**
 * A line for display: "1. e4 e5 2. Nf3". Repertoires start from the standard position, so
 * white plays the odd plies.
 */
export function formatLine(path: readonly RepertoireMove[]): string {
  if (path.length === 0) {
    return "Start position";
  }
  return path
    .map((move, ply) => (ply % 2 === 0 ? `${ply / 2 + 1}. ${move.san}` : move.san))
    .join(" ");
}

/** What `deleteMove` takes away, so a confirmation can say how much goes. */
export type RemovalPreview = { moveIds: string[]; positionIds: string[] };

/**
 * Mirrors the server: drop the move, then every position no longer reachable from the start
 * goes with all the moves that touch it. Positions still reachable by another move order stay.
 */
export function removalPreview(graph: RepertoireGraph, moveId: string): RemovalPreview {
  const removed = graph.moves.find((move) => move.id === moveId);
  if (!removed) {
    return { moveIds: [], positionIds: [] };
  }

  const kept = graph.moves.filter((move) => move.id !== moveId);
  const reachable = new Set([graph.startPositionId]);
  const queue = [graph.startPositionId];
  for (let head = 0; head < queue.length; head++) {
    for (const move of kept) {
      if (move.fromPositionId === queue[head] && !reachable.has(move.toPositionId)) {
        reachable.add(move.toPositionId);
        queue.push(move.toPositionId);
      }
    }
  }

  const positionIds = [
    ...new Set(
      graph.moves
        .flatMap((move) => [move.fromPositionId, move.toPositionId])
        .filter((id) => !reachable.has(id)),
    ),
  ];
  const gone = new Set(positionIds);
  const moveIds = graph.moves
    .filter(
      (move) => move.id === moveId || gone.has(move.fromPositionId) || gone.has(move.toPositionId),
    )
    .map((move) => move.id);
  return { moveIds, positionIds };
}
