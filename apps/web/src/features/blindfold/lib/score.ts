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

export type VerdictTier = "flawless" | "sharp" | "solid" | "building" | "warm_up";
export type Verdict = { tier: VerdictTier; label: string; message: string };

const VERDICTS: readonly (Verdict & { min: number })[] = [
  { min: 1, tier: "flawless", label: "Flawless", message: "Every answer right." },
  { min: 0.9, tier: "sharp", label: "Sharp", message: "Nearly perfect. Push for a clean run." },
  { min: 0.75, tier: "solid", label: "Solid", message: "Steady work. The board is taking shape." },
  {
    min: 0.5,
    tier: "building",
    label: "Building",
    message: "Getting there. Repeat it while it is fresh.",
  },
  {
    min: 0,
    tier: "warm_up",
    label: "Warm-up",
    message: "A start. Slow down and picture each square.",
  },
];

/** One-word verdict for an accuracy in [0, 1]: Flawless, Sharp (≥90%), Solid (≥75%), Building (≥50%) or Warm-up. */
export function verdictFor(fraction: number): Verdict {
  // Compare in whole hundredths so 0.9 computed as 18/20 is never just under the line.
  const percent = Math.round(fraction * 10_000) / 100;
  const found = VERDICTS.find((verdict) => percent >= verdict.min * 100) ?? VERDICTS.at(-1)!;
  return { tier: found.tier, label: found.label, message: found.message };
}

/** Whether `fraction` beats an earlier best. No earlier best (null or undefined) is never a new best. */
export function isPersonalBest(fraction: number, previousBest: number | null | undefined): boolean {
  return typeof previousBest === "number" && fraction > previousBest;
}

/** The longest run of `true` in a list of per-question results. */
export function longestRun(results: readonly boolean[]): number {
  let best = 0;
  let run = 0;
  for (const result of results) {
    run = result ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Average milliseconds per question; 0 when nothing was answered. */
export function averageMsPerQuestion({
  total,
  durationMs,
}: Pick<SessionSummary, "total" | "durationMs">): number {
  return total === 0 ? 0 : durationMs / total;
}
