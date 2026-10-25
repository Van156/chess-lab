/** The outcome of a finished drill session, as saved through `blindfold.recordSession`. */
export type SessionSummary = { correct: number; total: number; durationMs: number };

/** Fraction of correct answers in [0, 1]; 0 when nothing was answered. */
export function accuracy({ correct, total }: Pick<SessionSummary, "correct" | "total">): number {
  return total === 0 ? 0 : correct / total;
}

/** Builds the session summary from per-question results and the elapsed time. */
export function summariseSession(results: readonly boolean[], durationMs: number): SessionSummary {
  return {
    correct: results.filter(Boolean).length,
    total: results.length,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}
