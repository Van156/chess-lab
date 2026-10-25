import { useEffect, useReducer } from "react";

import {
  RANKING_DEPTH,
  RANKING_TOP_LINES,
  engine,
  type EngineJobHandle,
  type EngineLine,
} from "@/features/engine";

import {
  createRankingCache,
  emptyRankingState,
  gradeContinuations,
  rankingKey,
  rankingReducer,
  selectRanks,
  topMovesKey,
  type MoveRank,
  type RankableMove,
} from "../lib/continuation-ranking";

/** Searches kept for the session: about two per fork visited, far more than a repertoire has. */
const CACHE_LIMIT = 400;

/** Both kinds of search, each under its own key ({@link rankingKey}, {@link topMovesKey}). */
const searches = createRankingCache<EngineLine[]>(CACHE_LIMIT);

/** A search that is either answered from the session cache or submitted to the shared engine. */
type Pending = { lines: Promise<EngineLine[] | undefined>; cancel: () => void };

/**
 * The lines of one search. A cached search needs no engine; a finished one is cached; a cancelled
 * or failed one resolves to `undefined`, which grading treats as a missing search.
 */
function load(key: string, submit: () => EngineJobHandle): Pending {
  const cached = searches.get(key);
  if (cached) return { lines: Promise.resolve(cached), cancel: () => undefined };
  const handle = submit();
  return {
    lines: handle.result.then(
      (result) => {
        searches.set(key, result.lines);
        return result.lines;
      },
      () => undefined,
    ),
    cancel: handle.cancel,
  };
}

/**
 * Grades the stored continuations of the shown position against the engine. With at least one
 * continuation and the engine on, it runs two searches at {@link RANKING_DEPTH}: one restricted to
 * the stored moves (`searchMoves`) and one unrestricted at MultiPV {@link RANKING_TOP_LINES}, so a
 * lone move still gets a rank and the engine's own best move is known. The grade is filed under the
 * position. The grades of every fork analysed so far are kept (and the searches are cached for the
 * session), so earlier forks stay graded in the tree. Returns the grades of all of them by move id;
 * empty while the engine is off.
 *
 * Scheduling: both searches are `interactive`, like the suggestions, so background game analysis
 * never delays them, and they are submitted after the suggestions of the same position, so the
 * main engine search goes first. They are shallow and cancelled the moment the position changes or the
 * engine is switched off, which keeps them from holding up the next position's suggestions. The
 * main engine search is deeper and is not reused: coupling to its lifecycle is not worth one
 * extra shallow search.
 *
 * Re-render budget: only a finished grade updates state (one update per fork), never an engine
 * frame, so the memoised tree is not disturbed while the engine is thinking. When both searches
 * fail the position stays unranked; when only one finishes the grade degrades as
 * {@link gradeContinuations} describes.
 */
export function useContinuationRanking(input: {
  positionId: string;
  fen: string;
  /** The stored continuations of the position; graded when there is at least one. */
  moves: readonly RankableMove[];
  enabled: boolean;
}): ReadonlyMap<string, MoveRank> {
  const { positionId, fen, moves, enabled } = input;
  const [state, dispatch] = useReducer(rankingReducer, emptyRankingState);

  // The moves are a new array on every render; the effect depends on their content instead.
  const ids = moves.map((move) => move.id).join(",");
  const ucis = moves.map((move) => move.uci).join(",");

  useEffect(() => {
    const gradable = ids === "" ? [] : ids.split(",");
    if (!enabled || gradable.length < 1 || fen === "") {
      // No continuation left, or the engine is off: the old grades mean nothing.
      dispatch({ type: "positionDropped", positionId });
      return;
    }
    const uciList = ucis.split(",");
    const candidates = gradable.map((id, index) => ({ id, uci: uciList[index] ?? "" }));

    // The grades held for this position are dropped now if they came from another set of moves.
    // The grades are filed by move id, so the ids belong to what they are valid for.
    const validFor = `${rankingKey(fen, uciList)}#${ids}`;
    dispatch({ type: "searchStarted", positionId, key: validFor });

    let closed = false;
    const restricted = load(rankingKey(fen, uciList), () =>
      engine.analyse({
        fen,
        limit: { depth: RANKING_DEPTH },
        priority: "interactive",
        searchMoves: uciList,
      }),
    );
    const top = load(topMovesKey(fen), () =>
      engine.analyse({
        fen,
        limit: { depth: RANKING_DEPTH },
        priority: "interactive",
        multiPv: RANKING_TOP_LINES,
      }),
    );
    void Promise.all([restricted.lines, top.lines]).then(([restrictedLines, topLines]) => {
      // A cancelled search is not published; a late one finds the effect already closed.
      if (closed || (!restrictedLines && !topLines)) return;
      dispatch({
        type: "searchFinished",
        positionId,
        key: validFor,
        ranks: gradeContinuations(candidates, restrictedLines, topLines, fen).ranks,
      });
    });
    return () => {
      closed = true;
      restricted.cancel();
      top.cancel();
    };
  }, [positionId, fen, ids, ucis, enabled]);

  return enabled ? selectRanks(state) : selectRanks(emptyRankingState);
}
