import type { EngineLine } from "@/features/engine";

import { formatScore, type WhiteScore } from "./engine-view";

/** Where the engine puts one stored continuation among its siblings. */
export type MoveRank = {
  /** 1 is the best; moves with equal scores share a rank and the next rank is skipped. */
  rank: number;
  /** How many of the position's continuations the engine ranked. */
  of: number;
  /** The engine score from the point of view of the side that plays the move. */
  score: EngineLine["score"];
  /** Short score for the badge, such as "+0.34" or "#-2". */
  scoreLabel: string;
};

/** The stored continuation of a position, as the ranking sees it. */
export type RankableMove = { id: string; uci: string };

const MATE_VALUE = 100_000;

/** A single number to compare scores of the same mover: more is better, a faster mate is better. */
const strength = (score: EngineLine["score"]): number => {
  if (score.kind === "cp") return score.value;
  return score.value > 0 ? MATE_VALUE - score.value : -MATE_VALUE - score.value;
};

/**
 * An engine score is relative to the side to move, which is the mover of every continuation being
 * ranked, so it is shown as is: a plus sign is good for the player making the move.
 */
const moverLabel = (score: EngineLine["score"]): string => {
  const shown: WhiteScore =
    score.kind === "cp"
      ? { kind: "cp", cp: score.value }
      : { kind: "mate", moves: Math.abs(score.value), winner: score.value > 0 ? "white" : "black" };
  return formatScore(shown);
};

/**
 * Ranks the stored continuations of one position by the engine lines of a search restricted to
 * them. A line belongs to the move its first PV move equals. A move with no line is left out, so it
 * stays unranked. Equal scores share a rank. Pure.
 */
export function rankContinuations(
  moves: readonly RankableMove[],
  lines: readonly EngineLine[],
): Map<string, MoveRank> {
  const scored = new Map<string, { score: EngineLine["score"]; strength: number }>();
  for (const move of moves) {
    const found = lines.find((candidate) => candidate.pv[0] === move.uci);
    if (found) scored.set(move.id, { score: found.score, strength: strength(found.score) });
  }

  const ordered = [...scored.entries()].sort((a, b) => b[1].strength - a[1].strength);
  const ranks = new Map<string, MoveRank>();
  let rank = 0;
  let previous: number | null = null;
  ordered.forEach(([id, entry], index) => {
    if (previous === null || entry.strength !== previous) rank = index + 1;
    previous = entry.strength;
    ranks.set(id, {
      rank,
      of: ordered.length,
      score: entry.score,
      scoreLabel: moverLabel(entry.score),
    });
  });
  return ranks;
}

/**
 * Best rank first. Ranked items keep their stored order among equal ranks and unranked items follow
 * in stored order. With nothing ranked the very same list comes back, so a caller memoised on it
 * does not change. The input is not changed.
 */
export function sortByRank<T>(items: T[], rankOf: (item: T) => number | undefined): T[] {
  if (items.every((item) => rankOf(item) === undefined)) return items;
  return items
    .map((item, index) => ({ item, index, rank: rankOf(item) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
    .map(({ item }) => item);
}

/** What a search is cached under: the position and the exact set of moves it was restricted to. */
export function rankingKey(fen: string, ucis: readonly string[]): string {
  return `${fen}|${[...ucis].sort().join(",")}`;
}

/** A small least-recently-used map, so the session cache stays bounded. */
export function createRankingCache<V>(limit: number) {
  const entries = new Map<string, V>();
  return {
    get(key: string): V | undefined {
      const value = entries.get(key);
      if (value === undefined) return undefined;
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key: string, value: V): void {
      entries.delete(key);
      entries.set(key, value);
      const oldest = entries.keys().next();
      if (entries.size > limit && !oldest.done) entries.delete(oldest.value);
    },
  };
}
