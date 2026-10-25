import { describe, expect, test } from "bun:test";

import type { EngineLine } from "@/features/engine";

import {
  createRankingCache,
  emptyRankingState,
  gradeContinuations,
  rankContinuations,
  rankingKey,
  rankingReducer,
  selectRanks,
  sortByRank,
  topMovesKey,
  type MoveRank,
  type RankingState,
} from "./continuation-ranking";

const line = (multipv: number, first: string, score: EngineLine["score"]): EngineLine => ({
  multipv,
  depth: 12,
  score,
  pv: [first, "a7a6"],
});
const cp = (value: number): EngineLine["score"] => ({ kind: "cp", value });

const moves = [
  { id: "m1", uci: "c2c3" },
  { id: "m2", uci: "f1c4" },
  { id: "m3", uci: "b1c3" },
];

describe("rankContinuations", () => {
  test("ranks the moves by the score of the engine line that starts with them", () => {
    const ranks = rankContinuations(moves, [
      line(1, "f1c4", cp(40)),
      line(2, "c2c3", cp(25)),
      line(3, "b1c3", cp(-10)),
    ]);
    expect(ranks.get("m2")).toMatchObject({ rank: 1, of: 3, scoreLabel: "+0.40" });
    expect(ranks.get("m1")).toMatchObject({ rank: 2, of: 3, scoreLabel: "+0.25" });
    expect(ranks.get("m3")).toMatchObject({ rank: 3, of: 3, scoreLabel: "-0.10" });
  });

  test("orders by score even when the lines arrive out of order", () => {
    const ranks = rankContinuations(moves.slice(0, 2), [
      line(1, "c2c3", cp(-5)),
      line(2, "f1c4", cp(30)),
    ]);
    expect(ranks.get("m2")?.rank).toBe(1);
    expect(ranks.get("m1")?.rank).toBe(2);
  });

  test("gives equal scores the same rank and skips the next one", () => {
    const ranks = rankContinuations(moves, [
      line(1, "f1c4", cp(30)),
      line(2, "c2c3", cp(30)),
      line(3, "b1c3", cp(0)),
    ]);
    expect(ranks.get("m2")?.rank).toBe(1);
    expect(ranks.get("m1")?.rank).toBe(1);
    expect(ranks.get("m3")?.rank).toBe(3);
  });

  test("leaves a move without an engine line unranked", () => {
    const ranks = rankContinuations(moves, [line(1, "f1c4", cp(30)), line(2, "c2c3", cp(10))]);
    expect(ranks.has("m3")).toBe(false);
    expect(ranks.get("m2")?.of).toBe(2);
  });

  test("ignores engine lines for moves that are not in the list", () => {
    const ranks = rankContinuations(moves.slice(0, 1), [
      line(1, "g1f3", cp(90)),
      line(2, "c2c3", cp(10)),
    ]);
    expect([...ranks.keys()]).toEqual(["m1"]);
    expect(ranks.get("m1")?.rank).toBe(1);
  });

  test("keeps the score from the mover's side and ranks a mate above any pawn count", () => {
    const ranks = rankContinuations(moves, [
      line(1, "f1c4", { kind: "mate", value: 3 }),
      line(2, "c2c3", cp(900)),
      line(3, "b1c3", { kind: "mate", value: -2 }),
    ]);
    expect(ranks.get("m2")).toMatchObject({ rank: 1, scoreLabel: "#3" });
    expect(ranks.get("m1")?.rank).toBe(2);
    expect(ranks.get("m3")).toMatchObject({ rank: 3, scoreLabel: "#-2" });
  });

  test("prefers the faster mate", () => {
    const ranks = rankContinuations(moves.slice(0, 2), [
      line(1, "c2c3", { kind: "mate", value: 4 }),
      line(2, "f1c4", { kind: "mate", value: 2 }),
    ]);
    expect(ranks.get("m2")?.rank).toBe(1);
  });

  test("returns nothing without lines", () => {
    expect(rankContinuations(moves, []).size).toBe(0);
  });
});

describe("sortByRank", () => {
  const ranks = new Map([
    ["b", 1],
    ["c", 2],
  ]);
  const rankOf = (id: string) => ranks.get(id);

  test("sorts ranked items best first and keeps unranked ones last in stored order", () => {
    expect(sortByRank(["z", "c", "y", "b"], rankOf)).toEqual(["b", "c", "z", "y"]);
  });

  test("keeps the stored order of equal ranks", () => {
    expect(sortByRank(["q", "p"], () => 1)).toEqual(["q", "p"]);
  });

  test("returns the same list when nothing is ranked, and never changes its input", () => {
    const input = ["x", "y"];
    expect(sortByRank(input, () => undefined)).toBe(input);
    const unsorted = ["c", "b"];
    sortByRank(unsorted, rankOf);
    expect(unsorted).toEqual(["c", "b"]);
  });
});

describe("rankingKey", () => {
  test("is the position plus its sorted moves, so a new move asks again", () => {
    const first = rankingKey("fen", ["b1c3", "c2c3"]);
    expect(rankingKey("fen", ["c2c3", "b1c3"])).toBe(first);
    expect(rankingKey("fen", ["b1c3", "c2c3", "f1c4"])).not.toBe(first);
  });
});

describe("topMovesKey", () => {
  test("is the position's own key, apart from every restricted search of it", () => {
    expect(topMovesKey("fen")).toBe(topMovesKey("fen"));
    expect(topMovesKey("fen")).not.toBe(topMovesKey("other"));
    expect(topMovesKey("fen")).not.toBe(rankingKey("fen", ["c2c3"]));
    expect(topMovesKey("fen")).not.toBe(rankingKey("fen", []));
  });
});

describe("createRankingCache", () => {
  test("returns what was stored", () => {
    const cache = createRankingCache<number>(2);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("missing")).toBeUndefined();
  });

  test("drops the least recently used entry beyond its limit", () => {
    const cache = createRankingCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });
});

describe("rankingReducer", () => {
  const rank = (n: number): MoveRank => ({
    rank: n,
    of: 2,
    score: cp(0),
    scoreLabel: "+0.00",
  });
  const ranksOf = (...ids: string[]) => new Map(ids.map((id, index) => [id, rank(index + 1)]));
  const apply = (state: RankingState, ...actions: Parameters<typeof rankingReducer>[1][]) =>
    actions.reduce(rankingReducer, state);

  const ranked = apply(
    emptyRankingState,
    { type: "searchStarted", positionId: "p1", key: "k2" },
    { type: "searchFinished", positionId: "p1", key: "k2", ranks: ranksOf("a", "b") },
  );

  test("publishes the ranks of a finished search", () => {
    expect([...selectRanks(ranked).keys()]).toEqual(["a", "b"]);
  });

  test("drops the ranks at once when the set of moves changes but still has two or more", () => {
    const next = apply(ranked, { type: "searchStarted", positionId: "p1", key: "k3" });
    expect(selectRanks(next).size).toBe(0);
  });

  test("a cancelled search for the new set leaves no stale ranks", () => {
    const next = apply(ranked, { type: "searchStarted", positionId: "p1", key: "k3" });
    // No searchFinished ever arrives: still unranked.
    expect(selectRanks(next).size).toBe(0);
  });

  test("ignores a late result for a set that is no longer current", () => {
    const next = apply(
      ranked,
      { type: "searchStarted", positionId: "p1", key: "k3" },
      { type: "searchFinished", positionId: "p1", key: "k2", ranks: ranksOf("a", "b") },
    );
    expect(selectRanks(next).size).toBe(0);
  });

  test("ranks the new set once its own search finishes", () => {
    const next = apply(
      ranked,
      { type: "searchStarted", positionId: "p1", key: "k3" },
      { type: "searchFinished", positionId: "p1", key: "k3", ranks: ranksOf("a", "b", "c") },
    );
    expect([...selectRanks(next).keys()]).toEqual(["a", "b", "c"]);
  });

  test("ignores a result for a position that was dropped", () => {
    const next = apply(
      ranked,
      { type: "positionDropped", positionId: "p1" },
      { type: "searchFinished", positionId: "p1", key: "k2", ranks: ranksOf("a", "b") },
    );
    expect(selectRanks(next).size).toBe(0);
  });

  test("drops the ranks when the position falls below two moves", () => {
    expect(selectRanks(apply(ranked, { type: "positionDropped", positionId: "p1" })).size).toBe(0);
  });

  test("merges the ranks of every position", () => {
    const next = apply(
      ranked,
      { type: "searchStarted", positionId: "p2", key: "x" },
      { type: "searchFinished", positionId: "p2", key: "x", ranks: ranksOf("c", "d") },
    );
    expect([...selectRanks(next).keys()].sort()).toEqual(["a", "b", "c", "d"]);
    const after = apply(next, { type: "positionDropped", positionId: "p2" });
    expect([...selectRanks(after).keys()].sort()).toEqual(["a", "b"]);
  });

  test("keeps the same state and published map when nothing changed", () => {
    const again = apply(ranked, { type: "searchStarted", positionId: "p1", key: "k2" });
    expect(again).toBe(ranked);
    const fresh = apply(ranked, { type: "searchStarted", positionId: "p2", key: "y" });
    expect(selectRanks(fresh)).toBe(selectRanks(ranked));
    expect(apply(ranked, { type: "positionDropped", positionId: "nowhere" })).toBe(ranked);
  });

  test("publishes the same empty map when nothing is ranked, such as with the engine off", () => {
    const off = apply(ranked, { type: "positionDropped", positionId: "p1" });
    expect(selectRanks(off)).toBe(selectRanks(emptyRankingState));
  });
});

describe("gradeContinuations", () => {
  // White to move after 1. e4 e5 2. Nf3 Nc6 3. d4 exd4.
  const fen = "r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4";
  const c3 = { id: "m-c3", uci: "c2c3" };
  const bc4 = { id: "m-bc4", uci: "f1c4" };

  test("grades a lone stored move against the engine's top moves and names the better one", () => {
    const grade = gradeContinuations(
      [c3],
      [line(1, "c2c3", cp(10))],
      [line(1, "f1c4", cp(40)), line(2, "f3d4", cp(30)), line(3, "c2c3", cp(10))],
      fen,
    );
    expect(grade.ranks.get("m-c3")).toMatchObject({ rank: 3, of: 3, scoreLabel: "+0.10" });
    expect(grade.engineBest).toEqual({ san: "Bc4", scoreLabel: "+0.40" });
    expect(grade.ranks.get("m-c3")?.engineBest).toEqual(grade.engineBest);
  });

  test("ranks every stored move within the union of the top moves and the stored moves", () => {
    const grade = gradeContinuations(
      [c3, bc4],
      [line(1, "f1c4", cp(35)), line(2, "c2c3", cp(10))],
      [line(1, "f3d4", cp(50)), line(2, "f1c4", cp(40)), line(3, "e1e2", cp(20))],
      fen,
    );
    // Union: Nxd4 +0.50, Bc4 +0.40 (top score), Ke2 +0.20, c3 +0.10 (restricted, not in the top).
    expect(grade.ranks.get("m-bc4")).toMatchObject({ rank: 2, of: 4, scoreLabel: "+0.40" });
    expect(grade.ranks.get("m-c3")).toMatchObject({ rank: 4, of: 4, scoreLabel: "+0.10" });
    expect(grade.engineBest).toEqual({ san: "Nxd4", scoreLabel: "+0.50" });
  });

  test("scores a move that is in both lists once, from the top search", () => {
    const grade = gradeContinuations(
      [bc4],
      [line(1, "f1c4", cp(25))],
      [line(1, "f1c4", cp(40)), line(2, "f3d4", cp(30))],
      fen,
    );
    // Bc4 is the engine's own #1 in the top search; the restricted +0.25 must not demote it.
    expect(grade.ranks.get("m-bc4")).toMatchObject({ rank: 1, of: 2, scoreLabel: "+0.40" });
    expect(grade.engineBest).toBeUndefined();
  });

  test("ranks a stored move outside the top lines below all of them, by its restricted score", () => {
    const grade = gradeContinuations(
      [c3],
      [line(1, "c2c3", cp(-15))],
      [line(1, "f1c4", cp(40)), line(2, "f3d4", cp(30)), line(3, "e1e2", cp(20))],
      fen,
    );
    expect(grade.ranks.get("m-c3")).toMatchObject({ rank: 4, of: 4, scoreLabel: "-0.15" });
    expect(grade.engineBest).toEqual({ san: "Bc4", scoreLabel: "+0.40" });
  });

  test("names no better move when a stored move is the engine's best", () => {
    const grade = gradeContinuations(
      [bc4],
      [line(1, "f1c4", cp(40))],
      [line(1, "f1c4", cp(40)), line(2, "f3d4", cp(30))],
      fen,
    );
    expect(grade.ranks.get("m-bc4")?.rank).toBe(1);
    expect(grade.engineBest).toBeUndefined();
  });

  test("names no better move when a stored move ties with the engine's best", () => {
    const grade = gradeContinuations(
      [c3],
      [line(1, "c2c3", cp(40))],
      [line(1, "f1c4", cp(40)), line(2, "f3d4", cp(30))],
      fen,
    );
    expect(grade.ranks.get("m-c3")?.rank).toBe(1);
    expect(grade.engineBest).toBeUndefined();
  });

  test("shares a rank between equal scores and skips the next one", () => {
    const grade = gradeContinuations(
      [c3, bc4],
      [line(1, "f1c4", cp(30)), line(2, "c2c3", cp(30))],
      [line(1, "f3d4", cp(60)), line(2, "f1c4", cp(30))],
      fen,
    );
    expect(grade.ranks.get("m-bc4")?.rank).toBe(2);
    expect(grade.ranks.get("m-c3")?.rank).toBe(2);
    expect(grade.ranks.get("m-c3")?.of).toBe(3);
  });

  test("ranks a mate above any pawn count and prefers the faster mate", () => {
    const grade = gradeContinuations(
      [c3, bc4],
      [line(1, "f1c4", { kind: "mate", value: 3 }), line(2, "c2c3", cp(900))],
      [line(1, "f3d4", { kind: "mate", value: 5 }), line(2, "f1c4", { kind: "mate", value: 3 })],
      fen,
    );
    expect(grade.ranks.get("m-bc4")).toMatchObject({ rank: 1, scoreLabel: "#3" });
    expect(grade.ranks.get("m-c3")?.rank).toBe(3);
    expect(grade.engineBest).toBeUndefined();
  });

  test("shows the engine's best mate as the better move", () => {
    const grade = gradeContinuations(
      [c3],
      [line(1, "c2c3", cp(200))],
      [line(1, "f3d4", { kind: "mate", value: 4 })],
      fen,
    );
    expect(grade.engineBest).toEqual({ san: "Nxd4", scoreLabel: "#4" });
    expect(grade.ranks.get("m-c3")?.rank).toBe(2);
  });

  test("falls back to ranking the stored moves among themselves without a top search", () => {
    const grade = gradeContinuations(
      [c3, bc4],
      [line(1, "c2c3", cp(10)), line(2, "f1c4", cp(30))],
      undefined,
      fen,
    );
    expect(grade.ranks.get("m-bc4")).toMatchObject({ rank: 1, of: 2 });
    expect(grade.ranks.get("m-c3")).toMatchObject({ rank: 2, of: 2 });
    expect(grade.engineBest).toBeUndefined();
  });

  test("grades only the stored moves that appear in the top lines without a restricted search", () => {
    const grade = gradeContinuations(
      [c3, bc4],
      undefined,
      [line(1, "f3d4", cp(50)), line(2, "f1c4", cp(40)), line(3, "e1e2", cp(20))],
      fen,
    );
    expect(grade.ranks.has("m-c3")).toBe(false);
    expect(grade.ranks.get("m-bc4")).toMatchObject({ rank: 2, of: 3, scoreLabel: "+0.40" });
    expect(grade.engineBest).toEqual({ san: "Nxd4", scoreLabel: "+0.50" });
  });

  test("returns nothing without either search", () => {
    const grade = gradeContinuations([c3], undefined, undefined, fen);
    expect(grade.ranks.size).toBe(0);
    expect(grade.engineBest).toBeUndefined();
  });

  test("ignores a top line whose first move is not legal in the position", () => {
    const grade = gradeContinuations(
      [c3],
      [line(1, "c2c3", cp(10))],
      [line(1, "a1a8", cp(900)), line(2, "f1c4", cp(40))],
      fen,
    );
    expect(grade.engineBest).toEqual({ san: "Bc4", scoreLabel: "+0.40" });
    expect(grade.ranks.get("m-c3")).toMatchObject({ rank: 2, of: 2 });
  });
});
