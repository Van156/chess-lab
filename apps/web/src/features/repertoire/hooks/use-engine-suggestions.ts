import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  EngineJobCancelledError,
  SUGGESTION_DEPTH,
  SUGGESTION_LINES,
  engine,
} from "@/features/engine";

import { clampLineCount } from "../lib/lines-preference";
import { startSuggestionSearch } from "../lib/suggestion-run";

import {
  INITIAL_SUGGESTION_STATE,
  suggestionReducer,
  type SuggestionState,
} from "../lib/suggestion-state";

/**
 * Live Stockfish suggestions for one position. While `enabled`, it searches the position at
 * interactive priority, so the shared worker pauses background game analysis and resumes it later.
 * The search is cancelled on a position change, when disabled and on unmount. A position without
 * legal moves is never sent to the engine, and a failed engine reads as `unavailable` (the builder
 * keeps working); `retry` searches again.
 *
 * `multiPv` is the number of lines searched (1 to 5, three by default); changing it restarts the
 * search for the current position.
 *
 * Re-render budget: the engine reports a line every few milliseconds, so progress is coalesced to
 * at most one state update per animation frame, keeping only the latest snapshot.
 */
export function useEngineSuggestions(
  fen: string,
  enabled: boolean,
  multiPv: number = SUGGESTION_LINES,
): { state: SuggestionState; retry: () => void } {
  const [state, dispatch] = useReducer(suggestionReducer, INITIAL_SUGGESTION_STATE);
  const [attempt, setAttempt] = useState(0);
  const jobs = useRef(0);
  const lines = clampLineCount(multiPv);

  useEffect(() => {
    if (!enabled) {
      dispatch({ type: "disabled" });
      return;
    }
    jobs.current += 1;
    const job = jobs.current;
    return startSuggestionSearch({
      fen,
      job,
      depth: SUGGESTION_DEPTH,
      multiPv: lines,
      engine,
      isCancelled: (error) => error instanceof EngineJobCancelledError,
      requestFrame: (run) => requestAnimationFrame(run),
      cancelFrame: (frame) => cancelAnimationFrame(frame),
      dispatch,
    });
  }, [fen, enabled, lines, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry };
}
