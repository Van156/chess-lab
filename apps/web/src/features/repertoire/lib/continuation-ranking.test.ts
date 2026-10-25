import { describe, expect, test } from "bun:test";

import type { EngineLine } from "@/features/engine";

import {
  createRankingCache,
  rankContinuations,
  rankingKey,
  sortByRank,
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
