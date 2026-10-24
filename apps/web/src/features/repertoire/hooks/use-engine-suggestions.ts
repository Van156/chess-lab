import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { legalMoves } from "@b2c-template/chess";

import {
  EngineJobCancelledError,
  SUGGESTION_DEPTH,
  SUGGESTION_LINES,
  engine,
  type EngineInfo,
} from "@/features/engine";

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
    if (legalMoves(fen).length === 0) {
      dispatch({ type: "terminal", job, fen });
      return;
    }
    dispatch({ type: "started", job, fen });

    let closed = false;
    let frame: number | null = null;
    let latest: EngineInfo | null = null;
    const dropFrame = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      latest = null;
    };
    const flush = () => {
      frame = null;
      if (closed || latest === null) return;
      dispatch({ type: "progress", job, info: latest });
      latest = null;
    };

    const handle = engine.analyse({
      fen,
      limit: { depth: SUGGESTION_DEPTH },
      priority: "interactive",
      multiPv: SUGGESTION_LINES,
      onProgress: (info) => {
        if (closed) return;
        latest = info;
        frame ??= requestAnimationFrame(flush);
      },
    });
    handle.result.then(
      (result) => {
        if (closed) return;
        dropFrame();
        dispatch({ type: "finished", job, result });
      },
      (error: unknown) => {
        if (closed || error instanceof EngineJobCancelledError) return;
        dropFrame();
        dispatch({ type: "failed", job });
      },
    );

    return () => {
      closed = true;
      dropFrame();
      handle.cancel();
    };
  }, [fen, enabled, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry };
}
