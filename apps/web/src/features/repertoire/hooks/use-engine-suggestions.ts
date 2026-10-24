import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  EngineJobCancelledError,
  SUGGESTION_DEPTH,
  SUGGESTION_LINES,
  engine,
} from "@/features/engine";

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
 * Re-render budget: the engine reports a line every few milliseconds, so progress is coalesced to
 * at most one state update per animation frame, keeping only the latest snapshot.
 */
export function useEngineSuggestions(
  fen: string,
  enabled: boolean,
): { state: SuggestionState; retry: () => void } {
  const [state, dispatch] = useReducer(suggestionReducer, INITIAL_SUGGESTION_STATE);
  const [attempt, setAttempt] = useState(0);
  const jobs = useRef(0);

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
      multiPv: SUGGESTION_LINES,
      engine,
      isCancelled: (error) => error instanceof EngineJobCancelledError,
      requestFrame: (run) => requestAnimationFrame(run),
      cancelFrame: (frame) => cancelAnimationFrame(frame),
      dispatch,
    });
  }, [fen, enabled, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry };
}
