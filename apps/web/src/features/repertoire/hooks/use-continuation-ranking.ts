import { useEffect, useMemo, useState } from "react";

import { RANKING_DEPTH, engine, type EngineLine } from "@/features/engine";

import {
  createRankingCache,
  rankContinuations,
  rankingKey,
  type MoveRank,
  type RankableMove,
} from "../lib/continuation-ranking";

/** Searches kept for the session: about one per fork visited, far more than a repertoire has. */
const CACHE_LIMIT = 200;

const searches = createRankingCache<EngineLine[]>(CACHE_LIMIT);

type ByPosition = ReadonlyMap<string, ReadonlyMap<string, MoveRank>>;

const NO_RANKS: ReadonlyMap<string, MoveRank> = new Map();
const NO_POSITIONS: ByPosition = new Map();

/**
 * Ranks the stored continuations of the shown position by engine evaluation. With at least two
 * continuations and the engine on, it runs one search restricted to those moves (`searchMoves`)
 * and files the ranks under the position. The ranks of every fork analysed so far are kept (and the
 * searches are cached for the session), so earlier forks stay ranked in the tree. Returns the ranks
 * of all of them by move id; empty while the engine is off.
 *
 * Scheduling: the search is `interactive`, like the suggestions, so background game analysis never
 * delays it, and it is submitted after the suggestions of the same position, so the Engine tab goes
 * first. It is shallow ({@link RANKING_DEPTH}) and cancelled the moment the position changes or the
 * engine is switched off, which keeps it from holding up the next position's suggestions.
 *
 * Re-render budget: only a finished search updates state (one update per fork), never an engine
 * frame, so the memoised tree is not disturbed while the engine is thinking.
 */
export function useContinuationRanking(input: {
  positionId: string;
  fen: string;
  /** The stored continuations of the position; ranked only when there are two or more. */
  moves: readonly RankableMove[];
  enabled: boolean;
}): ReadonlyMap<string, MoveRank> {
  const { positionId, fen, moves, enabled } = input;
  const [byPosition, setByPosition] = useState<ByPosition>(NO_POSITIONS);

  // The moves are a new array on every render; the effect depends on their content instead.
  const ids = moves.map((move) => move.id).join(",");
  const ucis = moves.map((move) => move.uci).join(",");

  useEffect(() => {
    const rankable = ids === "" ? [] : ids.split(",");
    if (!enabled || rankable.length < 2 || fen === "") {
      // Fewer than two continuations left (a delete): the old ranks no longer mean anything.
      setByPosition((current) => {
        if (!current.has(positionId)) return current;
        const next = new Map(current);
        next.delete(positionId);
        return next;
      });
      return;
    }
    const uciList = ucis.split(",");
    const candidates = rankable.map((id, index) => ({ id, uci: uciList[index] ?? "" }));
    const key = rankingKey(fen, uciList);

    const store = (lines: EngineLine[]) => {
      const ranks = rankContinuations(candidates, lines);
      setByPosition((current) => new Map(current).set(positionId, ranks));
    };

    const cached = searches.get(key);
    if (cached) {
      store(cached);
      return;
    }

    let closed = false;
    const handle = engine.analyse({
      fen,
      limit: { depth: RANKING_DEPTH },
      priority: "interactive",
      searchMoves: uciList,
    });
    handle.result.then(
      (result) => {
        searches.set(key, result.lines);
        if (!closed) store(result.lines);
      },
      // A cancelled or failed search leaves the continuations unranked; the builder keeps working.
      () => undefined,
    );
    return () => {
      closed = true;
      handle.cancel();
    };
  }, [positionId, fen, ids, ucis, enabled]);

  return useMemo(() => {
    if (!enabled || byPosition.size === 0) return NO_RANKS;
    const all = new Map<string, MoveRank>();
    for (const ranks of byPosition.values()) {
      for (const [id, rank] of ranks) all.set(id, rank);
    }
    return all;
  }, [enabled, byPosition]);
}
