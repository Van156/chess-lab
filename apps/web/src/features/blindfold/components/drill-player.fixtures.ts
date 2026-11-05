import {
  answerQuestion,
  currentQuestion,
  nextQuestion,
  startSession,
  type DrillSession,
} from "../lib/drill-session";
import type { Answer, DrillKind, Question } from "../lib/questions";
import type { SessionSummary } from "../lib/score";

/** An answer that grades as right for any question. */
export function rightAnswer(question: Question): Answer {
  if (question.kind === "mate_in_one") return question.expected[0] ?? "";
  return question.expected;
}

/** A plausible wrong answer: the other colour, a neighbouring square, one move too many. */
export function wrongAnswer(question: Question): Answer {
  switch (question.kind) {
    case "square_colour":
      return question.expected === "light" ? "dark" : "light";
    case "coordinates": {
      const file = question.square.charCodeAt(0);
      const neighbour = String.fromCharCode(file === 104 ? file - 1 : file + 1);
      return `${neighbour}${question.square[1]}`;
    }
    case "diagonals": {
      const kept = question.expected.slice(0, -1);
      const stray = ["a1", "h1", "a8", "h8", "d4", "e4"].find(
        (square) => !question.expected.includes(square),
      );
      return [...kept, stray ?? "zz"];
    }
    case "knight_distance":
      return question.expected === 6 ? 5 : question.expected + 1;
    case "same_diagonal":
    case "check_detection":
      return question.expected === "yes" ? "no" : "yes";
    case "position_recall":
      return question.expected === "empty" ? "wP" : "empty";
    case "mate_in_one":
      return "Kh1";
  }
}

/**
 * A session at question `results.length + 1`, with those results already given (right or wrong
 * answers, a second apart), from a fixed seed so stories and tests are stable.
 */
export function askingSession(
  kind: DrillKind,
  results: readonly boolean[] = [true, true],
): DrillSession {
  let session = startSession({ kind, level: 1, seed: 11, now: 0 });
  results.forEach((right, index) => {
    const question = currentQuestion(session);
    const answered = answerQuestion(
      session,
      right ? rightAnswer(question) : wrongAnswer(question),
      (index + 1) * 1_000,
    );
    // Results are forced so stub drills still give the pattern asked for.
    session = nextQuestion(
      { ...answered, results: [...session.results, right] },
      (index + 1) * 1_000 + 200,
    );
  });
  return session;
}

/** The same session just after answering its current question. Wrong unless `correct`. */
export function feedbackSession(kind: DrillKind, { correct = false } = {}): DrillSession {
  const session = askingSession(kind);
  const question = currentQuestion(session);
  const answered = answerQuestion(
    session,
    correct ? rightAnswer(question) : wrongAnswer(question),
    3_000,
  );
  return { ...answered, results: [...session.results, correct] };
}

/** Halfway through, with a few misses and a live streak of five. */
export const MID_RUN_RESULTS: readonly boolean[] = [
  true,
  false,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
];

export const FINISHED_SUMMARY: SessionSummary = { correct: 17, total: 20, durationMs: 83_000 };
