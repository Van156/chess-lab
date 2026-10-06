/**
 * What the analysis does when the tab leaves the screen (ADR-12), independent of the DOM: flush the
 * evaluations gathered so far as soon as the tab is hidden (the browser may freeze or discard it),
 * and stop the run once it stayed hidden for `hiddenMs`. The hook feeds it the browser events and
 * injects the actions, so the timer logic is testable with a manual clock.
 */
export interface HiddenTabPolicyOptions {
  flush: () => void;
  stop: () => void;
  hiddenMs: number;
  /** Injected timers (defaults to `setTimeout`/`clearTimeout`) so tests control the clock. */
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface HiddenTabPolicy {
  visibilityChanged: (state: "visible" | "hidden") => void;
  pageHidden: () => void;
  /** Clears a pending stop timer (the hook unmounted or analysis was disabled). */
  dispose: () => void;
}

export function createHiddenTabPolicy({
  flush,
  stop,
  hiddenMs,
  setTimer = (run, ms) => setTimeout(run, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: HiddenTabPolicyOptions): HiddenTabPolicy {
  let stopTimer: unknown = null;
  const clear = () => {
    if (stopTimer !== null) clearTimer(stopTimer);
    stopTimer = null;
  };

  return {
    visibilityChanged(state) {
      clear();
      if (state !== "hidden") return;
      flush();
      stopTimer = setTimer(() => {
        stopTimer = null;
        stop();
      }, hiddenMs);
    },
    pageHidden: flush,
    dispose: clear,
  };
}
