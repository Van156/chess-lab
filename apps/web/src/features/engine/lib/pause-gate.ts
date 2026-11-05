/**
 * A gate the analysis loop waits on while it must not use the engine (a review session is open).
 * Closing it notifies listeners so the running search can be cancelled and redone later.
 */
export interface PauseGate {
  isPaused: () => boolean;
  setPaused: (paused: boolean) => void;
  /** Resolves immediately when open, otherwise when the gate next opens. */
  whenOpen: () => Promise<void>;
  /** Called each time the gate closes; returns the unsubscribe function. */
  onPause: (listener: () => void) => () => void;
}

export function createPauseGate(): PauseGate {
  let paused = false;
  let waiters: Array<() => void> = [];
  const listeners = new Set<() => void>();

  return {
    isPaused: () => paused,
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) {
        for (const listener of listeners) listener();
        return;
      }
      const pending = waiters;
      waiters = [];
      for (const wake of pending) wake();
    },
    whenOpen: () =>
      paused ? new Promise<void>((resolve) => waiters.push(resolve)) : Promise.resolve(),
    onPause(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
