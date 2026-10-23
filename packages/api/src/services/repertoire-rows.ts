import type {
  GraphMove,
  GraphPosition,
  PositionKey,
  RepertoireColor,
  RepertoireGraph,
} from "@b2c-template/chess";

export type PositionRow = {
  id: string;
  positionKey: PositionKey;
  fen: string;
  sideToMove: "w" | "b";
};
export type MoveRow = {
  id: string;
  fromPositionId: string;
  toPositionId: string;
  san: string;
  uci: string;
};

/** Whether the mover is the repertoire's own colour (derived, never stored). */
export function isUserMove(color: RepertoireColor, sideToMove: "w" | "b"): boolean {
  return (sideToMove === "w") === (color === "white");
}

/** Builds the pure graph of `packages/chess` from stored rows. Moves with a missing endpoint are dropped. */
export function rowsToGraph(
  color: RepertoireColor,
  positions: PositionRow[],
  moves: MoveRow[],
): RepertoireGraph {
  const byId = new Map(positions.map((p) => [p.id, p]));
  const graphPositions: Record<PositionKey, GraphPosition> = {};
  for (const p of positions) {
    graphPositions[p.positionKey] = { key: p.positionKey, fen: p.fen, sideToMove: p.sideToMove };
  }
  const graphMoves: GraphMove[] = [];
  for (const m of moves) {
    const from = byId.get(m.fromPositionId);
    const to = byId.get(m.toPositionId);
    if (!from || !to) continue;
    graphMoves.push({
      fromKey: from.positionKey,
      toKey: to.positionKey,
      san: m.san,
      uci: m.uci,
      isUserMove: isUserMove(color, from.sideToMove),
    });
  }
  return { color, positions: graphPositions, moves: graphMoves };
}

/** Ids of the positions reachable from `startId` by following `moves` (start included). */
export function reachablePositionIds(
  startId: string,
  moves: Pick<MoveRow, "fromPositionId" | "toPositionId">[],
): Set<string> {
  const children = new Map<string, string[]>();
  for (const m of moves) {
    const list = children.get(m.fromPositionId);
    if (list) list.push(m.toPositionId);
    else children.set(m.fromPositionId, [m.toPositionId]);
  }
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return seen;
}
