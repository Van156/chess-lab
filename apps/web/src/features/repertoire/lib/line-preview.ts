import { parseMove } from "@b2c-template/chess";

/** One move of a previewed line, with the position it leads to. */
export type PreviewStep = { san: string; uci: string; fenAfter: string };

/**
 * Previewing an engine line from a position. The steps are computed once, when the preview starts,
 * and kept: later engine frames can change the line list but never the line being previewed. The
 * cursor counts the line's moves shown on the board, from 1 (the first move played) to the length.
 */
export type LinePreview =
  | { kind: "idle" }
  | {
      kind: "previewing";
      /** The line's rank, counted from 0, as the engine block and the board colour it. */
      rank: number;
      /** The position the line starts from, which the preview belongs to. */
      baseFen: string;
      steps: readonly PreviewStep[];
      cursor: number;
    };

export type LinePreviewAction =
  | { type: "start"; rank: number; baseFen: string; pv: readonly string[] }
  | { type: "next" }
  | { type: "previous" }
  | { type: "exit" };

export const IDLE_PREVIEW: LinePreview = { kind: "idle" };

/**
 * Replays a UCI line from a position, keeping each move and the position after it. It stops at the
 * first move that is illegal or malformed, so a damaged line previews as far as it can be trusted.
 */
export function previewSteps(baseFen: string, pv: readonly string[]): PreviewStep[] {
  const steps: PreviewStep[] = [];
  let current = baseFen;
  for (const uci of pv) {
    const parsed = parseMove(current, uci);
    if (!parsed) break;
    steps.push({ san: parsed.san, uci: parsed.uci, fenAfter: parsed.fenAfter });
    current = parsed.fenAfter;
  }
  return steps;
}

/**
 * Reduces preview actions. A step past either end of the line, or any step while idle, returns the
 * same state object. A line with no legal first move cannot be previewed, so `start` stays idle.
 */
export function linePreviewReducer(state: LinePreview, action: LinePreviewAction): LinePreview {
  switch (action.type) {
    case "start": {
      const steps = previewSteps(action.baseFen, action.pv);
      return steps.length === 0
        ? IDLE_PREVIEW
        : { kind: "previewing", rank: action.rank, baseFen: action.baseFen, steps, cursor: 1 };
    }
    case "next":
      return state.kind === "previewing" && state.cursor < state.steps.length
        ? { ...state, cursor: state.cursor + 1 }
        : state;
    case "previous":
      return state.kind === "previewing" && state.cursor > 1
        ? { ...state, cursor: state.cursor - 1 }
        : state;
    case "exit":
      return IDLE_PREVIEW;
  }
}

/** What the board and the preview bar show for one preview. */
export type PreviewView = {
  rank: number;
  /** The position after the cursor's move. */
  fen: string;
  /** SAN of the move just played. */
  san: string;
  lastMove: { from: string; to: string };
  /** The line's next move, to draw in the line's colour; `null` at the end. */
  nextArrow: { from: string; to: string } | null;
  cursor: number;
  total: number;
  canPrevious: boolean;
  canNext: boolean;
};

const squares = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) });

/**
 * The preview in the terms the board and bar use; `null` while idle, and also when the builder has
 * moved to a position other than the one the preview started from, so a preview never outlives its
 * position.
 */
export function previewView(state: LinePreview, currentFen: string): PreviewView | null {
  if (state.kind !== "previewing" || state.baseFen !== currentFen) return null;
  const step = state.steps[state.cursor - 1];
  if (!step) return null;
  const next = state.steps[state.cursor];
  return {
    rank: state.rank,
    fen: step.fenAfter,
    san: step.san,
    lastMove: squares(step.uci),
    nextArrow: next ? squares(next.uci) : null,
    cursor: state.cursor,
    total: state.steps.length,
    canPrevious: state.cursor > 1,
    canNext: state.cursor < state.steps.length,
  };
}

/**
 * The preview action a key press stands for: ← and → step, Escape leaves. `controlUsesArrows` is
 * true when the focused control (a text field, a tab, a slider) needs the arrows for itself, so the
 * preview leaves them alone; Escape always leaves.
 */
export function previewKeyAction(
  key: string,
  controlUsesArrows: boolean,
): LinePreviewAction | null {
  if (key === "Escape") return { type: "exit" };
  if (controlUsesArrows) return null;
  if (key === "ArrowRight") return { type: "next" };
  if (key === "ArrowLeft") return { type: "previous" };
  return null;
}
