import { parseMove } from "@b2c-template/chess";

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
  /**
   * The engine's best move at this position when the repertoire does not have it. Every ranked
   * move of a position carries the same value; the tree decides where to show it.
   */
  engineBest?: EngineBest;
};

/** A move the engine prefers to everything the repertoire stores at a position. */
export type EngineBest = {
  san: string;
  /** Short score from the mover's side, such as "+0.40". */
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

type Scored = { score: EngineLine["score"]; strength: number };

const scored = (line: EngineLine): Scored => ({
  score: line.score,
  strength: strength(line.score),
});

/** Competition ranking (equal scores share a rank, the next rank is skipped), best first. Pure. */
function rankScored<K>(entries: ReadonlyMap<K, Scored>): Map<K, MoveRank> {
  const ordered = [...entries.entries()].sort((a, b) => b[1].strength - a[1].strength);
  const ranks = new Map<K, MoveRank>();
  let rank = 0;
  let previous: number | null = null;
  ordered.forEach(([key, entry], index) => {
    if (previous === null || entry.strength !== previous) rank = index + 1;
    previous = entry.strength;
    ranks.set(key, {
      rank,
      of: ordered.length,
      score: entry.score,
      scoreLabel: moverLabel(entry.score),
    });
  });
  return ranks;
}

/**
 * Ranks the stored continuations of one position by the engine lines of a search restricted to
 * them. A line belongs to the move its first PV move equals. A move with no line is left out, so it
 * stays unranked. Equal scores share a rank. Pure.
 */
export function rankContinuations(
  moves: readonly RankableMove[],
  lines: readonly EngineLine[],
): Map<string, MoveRank> {
  const entries = new Map<string, Scored>();
  for (const move of moves) {
    const found = lines.find((candidate) => candidate.pv[0] === move.uci);
    if (found) entries.set(move.id, scored(found));
  }
  return rankScored(entries);
}

/** How the engine grades the stored continuations of a position. */
export type ContinuationGrade = {
  /** Rank and score of each graded stored move, by move id; each carries `engineBest` too. */
  ranks: Map<string, MoveRank>;
  /** Set only when the best move of the field is not stored. */
  engineBest?: EngineBest;
};

/**
 * Grades the stored continuations of a position against the engine's own best moves. The field is
 * the union of the engine's top moves (`topLines`, an unrestricted search) and the stored moves
 * (`restrictedLines`, a search restricted to them). A move in both counts once and keeps its top
 * score, so every competitor is scored by the same search and the engine's own best move can never
 * be graded as beaten. The restricted score is used only for a stored move the top search did not
 * list. Ranks are competition ranks from the mover's side, over that union.
 *
 * `engineBest` names the field's best move when no stored move reaches rank 1, so a stored move
 * that ties with the engine's best is never reported as beaten. With no top search it degrades to
 * ranking the stored moves among themselves; with no restricted search only the stored moves that
 * are among the top moves can be graded. A top line whose first move is illegal in `fen` is dropped.
 * Pure.
 */
export function gradeContinuations(
  moves: readonly RankableMove[],
  restrictedLines: readonly EngineLine[] | undefined,
  topLines: readonly EngineLine[] | undefined,
  fen: string,
): ContinuationGrade {
  const storedUcis = new Set(moves.map((move) => move.uci));
  const field = new Map<string, Scored>();
  for (const line of topLines ?? []) {
    const uci = line.pv[0];
    if (!uci || field.has(uci)) continue;
    if (!storedUcis.has(uci) && !parseMove(fen, uci)) continue;
    field.set(uci, scored(line));
  }
  for (const move of moves) {
    // A move the top search scored keeps that score, so the whole field comes from one search.
    if (field.has(move.uci)) continue;
    const found = restrictedLines?.find((candidate) => candidate.pv[0] === move.uci);
    if (found) field.set(move.uci, scored(found));
  }

  const byUci = rankScored(field);
  const ranks = new Map<string, MoveRank>();
  for (const move of moves) {
    const rank = byUci.get(move.uci);
    if (rank) ranks.set(move.id, rank);
  }

  const best = [...field.entries()]
    .filter(([uci]) => !storedUcis.has(uci))
    .reduce<[string, Scored] | null>(
      (top, entry) => (!top || entry[1].strength > top[1].strength ? entry : top),
      null,
    );
  const storedBest = Math.max(
    Number.NEGATIVE_INFINITY,
    ...moves.map((move) => field.get(move.uci)?.strength ?? Number.NEGATIVE_INFINITY),
  );
  if (!best || best[1].strength <= storedBest) return { ranks };
  const san = parseMove(fen, best[0])?.san;
  if (!san) return { ranks };
  const engineBest = { san, scoreLabel: moverLabel(best[1].score) };
  for (const [id, rank] of ranks) ranks.set(id, { ...rank, engineBest });
  return { ranks, engineBest };
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

/** What the position's unrestricted top-moves search is cached under; never a restricted key. */
export function topMovesKey(fen: string): string {
  return `${fen}|top`;
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
