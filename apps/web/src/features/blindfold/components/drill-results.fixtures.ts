import { startSession } from "../lib/drill-session";
import type { Answer } from "../lib/questions";
import type { SessionSummary } from "../lib/score";
import { buildReview, type ReviewItem } from "../lib/session-review";

/** Results of 17/20, with three misses spread through the session. */
export const RESULTS: readonly boolean[] = Array.from(
  { length: 20 },
  (_, index) => ![3, 11, 12].includes(index),
);

/** A 20-question knight distance session answered as `RESULTS` says, built through `buildReview`. */
export function knightReview(results: readonly boolean[] = RESULTS): ReviewItem[] {
  const session = startSession({ kind: "knight_distance", level: 2, seed: 7, now: 0 });
  const answers: Answer[] = session.questions.map((question, index) => {
    const expected = question.kind === "knight_distance" ? question.expected : 0;
    return results[index] ? expected : expected + 1;
  });
  return buildReview({ ...session, results, answers });
}

export const PERFECT_SUMMARY: SessionSummary = { correct: 20, total: 20, durationMs: 61_400 };
