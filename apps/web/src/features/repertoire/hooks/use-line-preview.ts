import { useCallback, useEffect, useMemo, useReducer } from "react";

import { usesArrows } from "../lib/arrow-controls";
import {
  IDLE_PREVIEW,
  linePreviewReducer,
  previewKeyAction,
  previewView,
  type PreviewView,
} from "../lib/line-preview";

/**
 * The engine line being previewed on the board, if any. Its state is the pure reducer's; while a
 * preview is open, ← and → step through it and Escape leaves it. `start` takes the line's UCI
 * moves, which the reducer replays from the position the preview began at. The preview shows only
 * while `currentFen` is that position.
 */
export function useLinePreview(currentFen: string): {
  view: PreviewView | null;
  start: (rank: number, baseFen: string, pv: readonly string[]) => void;
  next: () => void;
  previous: () => void;
  exit: () => void;
} {
  const [state, dispatch] = useReducer(linePreviewReducer, IDLE_PREVIEW);
  const view = useMemo(() => previewView(state, currentFen), [state, currentFen]);
  const active = view !== null;

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const action = previewKeyAction(event.key, usesArrows(event.target));
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  return {
    view,
    start: useCallback((rank, baseFen, pv) => dispatch({ type: "start", rank, baseFen, pv }), []),
    next: useCallback(() => dispatch({ type: "next" }), []),
    previous: useCallback(() => dispatch({ type: "previous" }), []),
    exit: useCallback(() => dispatch({ type: "exit" }), []),
  };
}
