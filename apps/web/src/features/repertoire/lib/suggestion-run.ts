/**
 * One suggestion search, independent of React: the engine, the frame scheduler and the dispatch
 * are injected, so the search is tested with fakes. The runtime pieces (the engine, its
 * cancellation error and the depth and line limits) come in from the hook because the engine
 * index cannot load outside the app.
 */
import { legalMoves } from "@b2c-template/chess";

import type { EngineInfo, EngineJobHandle, EngineJobRequest } from "@/features/engine";

import type { SuggestionEvent } from "./suggestion-state";

export interface SuggestionEngine {
  analyse: (request: EngineJobRequest) => EngineJobHandle;
}

export interface SuggestionSearchOptions {
  fen: string;
  /** Names this search in every event, so a late event of an older job is ignored. */
  job: number;
  /** The depth the search aims for. */
  depth: number;
  /** Number of lines to search. */
  multiPv: number;
  engine: SuggestionEngine;
  /** Whether a rejection is the engine cancelling the job, which is expected and silent. */
  isCancelled: (error: unknown) => boolean;
  requestFrame: (run: () => void) => number;
  cancelFrame: (frame: number) => void;
  dispatch: (event: SuggestionEvent) => void;
}

/**
 * Starts a search and returns `close`, which cancels it and silences every later event. A position
 * without legal moves is reported as `terminal` and never sent to the engine. The engine reports a
 * line every few milliseconds, so progress is coalesced to one dispatch per frame, keeping only the
 * latest snapshot; a finish or a close drops the pending frame.
 */
export function startSuggestionSearch({
  fen,
  job,
  depth,
  multiPv,
  engine,
  isCancelled,
  requestFrame,
  cancelFrame,
  dispatch,
}: SuggestionSearchOptions): () => void {
  if (legalMoves(fen).length === 0) {
    dispatch({ type: "terminal", job, fen });
    return () => {};
  }
  dispatch({ type: "started", job, fen });

  let closed = false;
  let frame: number | null = null;
  let latest: EngineInfo | null = null;
  const dropFrame = () => {
    if (frame !== null) cancelFrame(frame);
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
    limit: { depth },
    priority: "interactive",
    multiPv,
    onProgress: (info) => {
      if (closed) return;
      latest = info;
      frame ??= requestFrame(flush);
    },
  });
  handle.result.then(
    (result) => {
      if (closed) return;
      dropFrame();
      dispatch({ type: "finished", job, result });
    },
    (error: unknown) => {
      if (closed || isCancelled(error)) return;
      dropFrame();
      dispatch({ type: "failed", job });
    },
  );

  return () => {
    closed = true;
    dropFrame();
    handle.cancel();
  };
}
