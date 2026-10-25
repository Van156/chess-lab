import { answerQuestion, currentQuestion, startSession } from "../lib/drill-session";
import type { DrillKind } from "../lib/questions";
import type { SessionSummary } from "../lib/score";

/** A session on its third question, with a fixed seed so stories and tests are stable. */
export function askingSession(kind: DrillKind) {
  let session = startSession({ kind, level: 1, seed: 11, now: 0 });
  for (let answered = 0; answered < 2; answered += 1) {
    session = { ...session, results: [...session.results, true], index: session.index + 1 };
  }
  return session;
}

/** The same session just after a wrong answer. */
export function feedbackSession(kind: DrillKind) {
  const session = askingSession(kind);
  const wrong = kind === "knight_distance" ? 99 : "zz";
  return answerQuestion(session, currentQuestion(session).kind === "diagonals" ? ["zz"] : wrong);
}

export const FINISHED_SUMMARY: SessionSummary = { correct: 17, total: 20, durationMs: 83_000 };
