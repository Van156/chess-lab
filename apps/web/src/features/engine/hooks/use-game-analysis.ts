import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useReducer, useRef, useState } from "react";

import { client, orpc } from "@/app/orpc";

import { PAUSE_HIDDEN_MS } from "../config";
import { createAnalysisRun, type AnalysisApi, type AnalysisRun } from "../lib/analysis-run";
import { initialStatus, isReviewPath, reduceStatus } from "../lib/analysis-status";
import { createPauseGate } from "../lib/pause-gate";
import { engine } from "../lib/shared-engine";

const api: AnalysisApi = {
  next: () => client.analysis.next(),
  submitEvals: (input) => client.analysis.submitEvals(input),
  complete: (input) => client.analysis.complete(input),
};

/**
 * Runs the analysis pipeline (ADR-12) in the background while mounted: the loop lives in
 * `createAnalysisRun`; this hook binds it to React and the browser. It yields the engine while the
 * review route is open, sends the evaluations gathered so far when the tab is hidden or closing,
 * and stops after the tab has been hidden for `PAUSE_HIDDEN_MS`. `resume` starts it again; the
 * server's resume point means no finished work is repeated.
 */
export function useGameAnalysis({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const [status, dispatch] = useReducer(reduceStatus, initialStatus);
  const [gate] = useState(createPauseGate);
  const [attempt, setAttempt] = useState(0);
  const runRef = useRef<AnalysisRun | null>(null);
  const reviewOpen = useRouterState({ select: (state) => isReviewPath(state.location.pathname) });

  useEffect(() => {
    gate.setPaused(reviewOpen);
    dispatch({ type: reviewOpen ? "paused" : "resumed" });
  }, [gate, reviewOpen]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = createAnalysisRun({
      api,
      engine,
      gate,
      onEvent: (event) => {
        if (cancelled) return;
        dispatch(event);
        if (event.type === "gameCompleted") {
          // New mistakes and cards: the review queue, Today's counts and the games and mistakes
          // lists (analysis status, new mistakes) are out of date.
          void queryClient.invalidateQueries({ queryKey: orpc.review.queue.key() });
          void queryClient.invalidateQueries({ queryKey: orpc.today.summary.key() });
          void queryClient.invalidateQueries({ queryKey: orpc.games.list.key() });
          void queryClient.invalidateQueries({ queryKey: orpc.mistakes.list.key() });
        }
      },
    });
    runRef.current = run;
    dispatch({ type: "started" });
    if (gate.isPaused()) dispatch({ type: "paused" });
    void run.start().then((outcome) => {
      if (!cancelled) dispatch({ type: outcome });
    });
    return () => {
      cancelled = true;
      runRef.current = null;
      run.stop();
    };
  }, [enabled, attempt, gate, queryClient]);

  useEffect(() => {
    if (!enabled) return;
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    const onVisibility = () => {
      clearTimeout(hiddenTimer);
      if (document.visibilityState === "hidden") {
        void runRef.current?.flush();
        hiddenTimer = setTimeout(() => runRef.current?.stop(), PAUSE_HIDDEN_MS);
      }
    };
    const onPageHide = () => void runRef.current?.flush();
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [enabled]);

  return { status, resume: () => setAttempt((value) => value + 1) };
}
