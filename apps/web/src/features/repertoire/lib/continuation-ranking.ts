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

type RankingEntry = {
  /** The exact set of moves the position's search was restricted to ({@link rankingKey}). */
  key: string;
  /** Null until the search for `key` finishes. */
  ranks: ReadonlyMap<string, MoveRank> | null;
};

/**
 * The ranks of every fork analysed so far, each valid only for the set of moves it was computed
 * from. `ranks` is the merged, published view; it keeps its identity while no rank changes.
 */
export type RankingState = {
  entries: ReadonlyMap<string, RankingEntry>;
  ranks: ReadonlyMap<string, MoveRank>;
};

export type RankingAction =
  | { type: "searchStarted"; positionId: string; key: string }
  | {
      type: "searchFinished";
      positionId: string;
      key: string;
      ranks: ReadonlyMap<string, MoveRank>;
    }
  | { type: "positionDropped"; positionId: string };

const NO_RANKS: ReadonlyMap<string, MoveRank> = new Map();

export const emptyRankingState: RankingState = { entries: new Map(), ranks: NO_RANKS };

const merge = (entries: ReadonlyMap<string, RankingEntry>): ReadonlyMap<string, MoveRank> => {
  const all = new Map<string, MoveRank>();
  for (const entry of entries.values()) {
    for (const [id, rank] of entry.ranks ?? NO_RANKS) all.set(id, rank);
  }
  return all.size === 0 ? NO_RANKS : all;
};

/** The entries changed; republish the merged ranks only when the position had ranks before or has them now. */
const withEntries = (
  state: RankingState,
  entries: Map<string, RankingEntry>,
  ranksChanged: boolean,
): RankingState => ({ entries, ranks: ranksChanged ? merge(entries) : state.ranks });

/**
 * Keeps each position's ranks valid for the exact set of moves they were computed from. A search
 * for a different set drops the old ranks at once (the tree falls back to the stored order), and a
 * result whose set is no longer current is ignored, so a cancelled, failed or late search can never
 * leave or bring back stale ranks. Pure.
 */
export function rankingReducer(state: RankingState, action: RankingAction): RankingState {
  const current = state.entries.get(action.positionId);
  switch (action.type) {
    case "searchStarted": {
      if (current?.key === action.key) return state;
      const entries = new Map(state.entries).set(action.positionId, {
        key: action.key,
        ranks: null,
      });
      return withEntries(state, entries, (current?.ranks?.size ?? 0) > 0);
    }
    case "searchFinished": {
      if (current?.key !== action.key) return state;
      const entries = new Map(state.entries).set(action.positionId, {
        key: action.key,
        ranks: action.ranks,
      });
      return withEntries(state, entries, action.ranks.size > 0 || (current.ranks?.size ?? 0) > 0);
    }
    case "positionDropped": {
      if (!current) return state;
      const entries = new Map(state.entries);
      entries.delete(action.positionId);
      return withEntries(state, entries, (current.ranks?.size ?? 0) > 0);
    }
  }
}

/** The ranks of all positions by move id; the same empty map while nothing is ranked. */
export const selectRanks = (state: RankingState): ReadonlyMap<string, MoveRank> => state.ranks;
