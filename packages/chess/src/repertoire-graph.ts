import { parseMove, positionKey } from "./position";
import type { PositionKey } from "./position";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type RepertoireColor = "white" | "black";

export type GraphPosition = {
  key: PositionKey;
  /** FEN as first reached; clocks may differ from other paths to the same key. */
  fen: string;
  sideToMove: "w" | "b";
};

export type GraphMove = {
  fromKey: PositionKey;
  toKey: PositionKey;
  san: string;
  uci: string;
  /** True when the mover is the repertoire's own colour. */
  isUserMove: boolean;
};

/** Plain, serializable repertoire: positions keyed by normalized FEN, moves as edges. */
export type RepertoireGraph = {
  color: RepertoireColor;
  positions: Record<PositionKey, GraphPosition>;
  moves: GraphMove[];
};

export type AddMoveResult =
  | { status: "added"; graph: RepertoireGraph; move: GraphMove; createdPosition: boolean }
  | { status: "duplicate"; move: GraphMove }
  | { status: "illegal" | "cycle" | "unknown-position" };

export function createGraph(color: RepertoireColor): RepertoireGraph {
  const key = positionKey(START_FEN);
  return { color, positions: { [key]: { key, fen: START_FEN, sideToMove: "w" } }, moves: [] };
}

/** Whether `target` can be reached from `start` by following moves. */
function reaches(moves: GraphMove[], start: PositionKey, target: PositionKey): boolean {
  const seen = new Set<PositionKey>();
  const stack = [start];
  while (stack.length > 0) {
    const key = stack.pop()!;
    if (key === target) return true;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const m of moves) if (m.fromKey === key) stack.push(m.toKey);
  }
  return false;
}

/**
 * Plays `input` (SAN or UCI) from a position of the graph. Never mutates the graph.
 * A target already in the graph is reused (transposition); a move that would lead back
 * to a position that can already reach its source is rejected as a cycle.
 */
export function addMove(
  graph: RepertoireGraph,
  fromKey: PositionKey,
  input: string,
): AddMoveResult {
  const from = graph.positions[fromKey];
  if (!from) return { status: "unknown-position" };

  const parsed = parseMove(from.fen, input);
  if (!parsed) return { status: "illegal" };

  const toKey = positionKey(parsed.fenAfter);
  const existing = graph.moves.find((m) => m.fromKey === fromKey && m.uci === parsed.uci);
  if (existing) return { status: "duplicate", move: existing };

  if (reaches(graph.moves, toKey, fromKey)) return { status: "cycle" };

  const move: GraphMove = {
    fromKey,
    toKey,
    san: parsed.san,
    uci: parsed.uci,
    isUserMove: (from.sideToMove === "w") === (graph.color === "white"),
  };
  const createdPosition = !(toKey in graph.positions);
  const positions = createdPosition
    ? {
        ...graph.positions,
        [toKey]: {
          key: toKey,
          fen: parsed.fenAfter,
          sideToMove: from.sideToMove === "w" ? "b" : "w",
        } as GraphPosition,
      }
    : graph.positions;
  return {
    status: "added",
    graph: { ...graph, positions, moves: [...graph.moves, move] },
    move,
    createdPosition,
  };
}
