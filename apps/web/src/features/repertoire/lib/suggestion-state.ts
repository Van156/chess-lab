import type { EngineInfo, EngineLine, EngineResult } from "@/features/engine";

import { toSuggestionLines, winPercent, type SuggestionLine } from "./engine-view";

/**
 * What the suggestion hook knows about the search. Every state after `off` names the job and the
 * position it belongs to, so a late event of an older job can never land in a newer one.
 */
export type SuggestionState =
  | { kind: "off" }
  | { kind: "starting"; job: number; fen: string }
  | { kind: "analysing"; job: number; fen: string; depth: number; lines: EngineLine[] }
  | { kind: "done"; job: number; fen: string; depth: number; lines: EngineLine[] }
  | { kind: "unavailable"; job: number; fen: string }
  /** The position has no legal moves, so it is never sent to the engine. */
  | { kind: "terminal"; job: number; fen: string };

export type SuggestionEvent =
  | { type: "disabled" }
  | { type: "started"; job: number; fen: string }
  | { type: "terminal"; job: number; fen: string }
  | { type: "progress"; job: number; info: EngineInfo }
  | { type: "finished"; job: number; result: EngineResult }
  | { type: "failed"; job: number };

export const INITIAL_SUGGESTION_STATE: SuggestionState = { kind: "off" };

/**
 * Reduces search events. `started` and `terminal` open a new job and replace everything before it;
 * progress, results and failures only apply to the running job they were issued for, so a stale
 * event returns the same state object.
 */
export function suggestionReducer(state: SuggestionState, event: SuggestionEvent): SuggestionState {
  switch (event.type) {
    case "disabled":
      return state.kind === "off" ? state : { kind: "off" };
    case "started":
      return { kind: "starting", job: event.job, fen: event.fen };
    case "terminal":
      return { kind: "terminal", job: event.job, fen: event.fen };
  }
  if ((state.kind !== "starting" && state.kind !== "analysing") || state.job !== event.job) {
    return state;
  }
  switch (event.type) {
    case "progress":
      return {
        kind: "analysing",
        job: state.job,
        fen: state.fen,
        depth: event.info.depth,
        lines: event.info.lines,
      };
    case "finished":
      return {
        kind: "done",
        job: state.job,
        fen: state.fen,
        depth: event.result.depth,
        lines: event.result.lines,
      };
    case "failed":
      return { kind: "unavailable", job: state.job, fen: state.fen };
  }
}

/** What the panel renders. `analysing` and `done` share a shape; only the depth is still moving. */
export type EnginePanelState =
  | { kind: "off" }
  | { kind: "starting" }
  | { kind: "analysing" | "done"; depth: number; maxDepth: number; lines: SuggestionLine[] }
  | { kind: "unavailable" }
  | { kind: "terminal" };

export type EngineView = {
  panel: EnginePanelState;
  /** White's share of the eval bar, 0 to 100; `null` without a score. */
  whitePercent: number | null;
};

const NO_EVAL = { whitePercent: null } as const;

/**
 * Maps the search state to the panel, and the eval bar. A state that belongs to another
 * position counts as starting, so old lines are never drawn on a new position. The depth and ply
 * limits come in as inputs, which keeps this module free of the engine runtime.
 */
export function toEngineView(input: {
  state: SuggestionState;
  fen: string;
  enabled: boolean;
  childMoves: readonly { san: string }[];
  /** The depth the search aims for, shown next to the current one. */
  maxDepth: number;
  /** Plies of each line to show. */
  maxPlies: number;
}): EngineView {
  const { state, fen, enabled, childMoves, maxDepth, maxPlies } = input;
  if (!enabled) return { panel: { kind: "off" }, ...NO_EVAL };
  if (state.kind === "off" || state.fen !== fen || state.kind === "starting") {
    return { panel: { kind: "starting" }, ...NO_EVAL };
  }
  if (state.kind === "unavailable" || state.kind === "terminal") {
    return { panel: { kind: state.kind }, ...NO_EVAL };
  }
  const lines = toSuggestionLines(fen, state.lines, childMoves, maxPlies);
  const best = lines.find((line) => line.multipv === 1);
  return {
    panel: { kind: state.kind, depth: state.depth, maxDepth, lines },
    whitePercent: best ? winPercent(best.white) : null,
  };
}
