import { describe, expect, test } from "bun:test";
import { positionKey } from "./position";
import { addMove, createGraph, START_FEN } from "./repertoire-graph";
import type { RepertoireGraph } from "./repertoire-graph";

const startKey = positionKey(START_FEN);

/** Plays SAN moves from the start position, asserting each one is accepted. */
function play(graph: RepertoireGraph, sans: string[]): RepertoireGraph {
  let current = graph;
  let from = startKey;
  for (const san of sans) {
    const result = addMove(current, from, san);
    if (result.status !== "added" && result.status !== "duplicate") {
      throw new Error(`${san}: ${result.status}`);
    }
    if (result.status === "added") current = result.graph;
    from = result.move.toKey;
  }
  return current;
}

describe("createGraph", () => {
  test("starts with only the initial position", () => {
    const graph = createGraph("white");
    expect(Object.keys(graph.positions)).toEqual([startKey]);
    expect(graph.moves).toEqual([]);
  });
});

describe("addMove", () => {
  test("adds a chain and marks only the repertoire colour's move as the user's", () => {
    const graph = play(createGraph("white"), ["e4", "e5"]);
    expect(graph.moves.map((m) => [m.san, m.isUserMove])).toEqual([
      ["e4", true],
      ["e5", false],
    ]);
    expect(Object.keys(graph.positions)).toHaveLength(3);
  });

  test("marks Black's moves as the user's in a black repertoire", () => {
    const graph = play(createGraph("black"), ["e4", "e5"]);
    expect(graph.moves.map((m) => m.isUserMove)).toEqual([false, true]);
  });

  test("branches from the same position", () => {
    const graph = play(createGraph("white"), ["e4"]);
    const result = addMove(graph, startKey, "d4");
    expect(result.status).toBe("added");
    if (result.status !== "added") return;
    expect(result.graph.moves.filter((m) => m.fromKey === startKey)).toHaveLength(2);
  });

  test("stores nothing for an illegal move", () => {
    const graph = createGraph("white");
    const result = addMove(graph, startKey, "e5");
    expect(result.status).toBe("illegal");
    expect(graph.moves).toEqual([]);
    expect(Object.keys(graph.positions)).toHaveLength(1);
  });

  test("reports an existing move as a duplicate without changing the graph", () => {
    const graph = play(createGraph("white"), ["e4", "e5"]);
    const e4Key = graph.moves[0]!.toKey;
    const result = addMove(graph, e4Key, "e7e5");
    expect(result.status).toBe("duplicate");
    expect(graph.moves).toHaveLength(2);
  });

  test("merges transpositions into one position", () => {
    const graph = play(play(createGraph("white"), ["d4", "Nf6", "c4"]), ["c4", "Nf6", "d4"]);
    // start, d4, c4, d4 Nf6, c4 Nf6 and the shared position after both orders.
    expect(Object.keys(graph.positions)).toHaveLength(6);
    const shared = graph.moves.filter((m) => m.san === "c4" || m.san === "d4");
    const incoming = shared.filter((m) => m.fromKey !== startKey).map((m) => m.toKey);
    expect(incoming).toHaveLength(2);
    expect(incoming[0]).toBe(incoming[1]);
  });

  test("merges positions whose FENs differ only by move clocks", () => {
    // The halfmove clocks differ: the pawn move resets it at a different ply.
    const graph = play(play(createGraph("white"), ["e4", "Nf6", "Nc3"]), ["Nc3", "Nf6", "e4"]);
    expect(Object.keys(graph.positions)).toHaveLength(6);
    const last = graph.moves.filter((m) => m.san === "Nc3" || m.san === "e4");
    const incoming = last.filter((m) => m.fromKey !== startKey).map((m) => m.toKey);
    expect(incoming[0]).toBe(incoming[1]);
  });

  test("rejects a move that returns to an ancestor position", () => {
    const graph = play(createGraph("white"), ["Nf3", "Nf6", "Ng1"]);
    const g1Key = graph.moves[2]!.toKey;
    const result = addMove(graph, g1Key, "Ng8");
    expect(result.status).toBe("cycle");
    expect(graph.moves).toHaveLength(3);
  });

  test("reports an unknown source position", () => {
    const result = addMove(createGraph("white"), "nope" as never, "e4");
    expect(result.status).toBe("unknown-position");
  });
});
