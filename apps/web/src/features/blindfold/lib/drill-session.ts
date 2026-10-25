import {
  generateQuestions,
  isCorrect,
  type Answer,
  type DrillKind,
  type Question,
} from "./questions";
import { summariseSession, type SessionSummary } from "./score";

export type SessionPhase = "asking" | "feedback" | "finished";

/** The state of one timed drill session. Immutable: every transition returns a new value. */
export type DrillSession = {
  kind: DrillKind;
  level: number;
  questions: readonly Question[];
  /** Index of the question being asked (or reviewed, during feedback). */
  index: number;
  phase: SessionPhase;
  /** One entry per answered question. */
  results: readonly boolean[];
  /** The answer just given, shown during feedback; null otherwise. */
  lastAnswer: Answer | null;
  startedAt: number;
  finishedAt: number | null;
};

export type StartOptions = {
  kind: DrillKind;
  level: number;
  seed: number;
  /** Epoch milliseconds the clock starts from. */
  now: number;
  /** Defaults to a 20-question session. */
  count?: number;
};

/** Begins a session on its first question. */
export function startSession({ now, count, ...options }: StartOptions): DrillSession {
  return {
    kind: options.kind,
    level: options.level,
    questions: generateQuestions({ ...options, ...(count === undefined ? {} : { count }) }),
    index: 0,
    phase: "asking",
    results: [],
    lastAnswer: null,
    startedAt: now,
    finishedAt: null,
  };
}

/** The question on screen. */
export function currentQuestion(session: DrillSession): Question {
  const question = session.questions[session.index];
  if (!question) throw new RangeError("The session has no current question.");
  return question;
}

/** Grades an answer and shows feedback. A second answer to the same question is ignored. */
export function answerQuestion(session: DrillSession, answer: Answer): DrillSession {
  if (session.phase !== "asking") return session;
  return {
    ...session,
    phase: "feedback",
    results: [...session.results, isCorrect(currentQuestion(session), answer)],
    lastAnswer: answer,
  };
}

/** Moves past the feedback to the next question, or finishes the session after the last one. */
export function nextQuestion(session: DrillSession, now: number): DrillSession {
  if (session.phase !== "feedback") return session;
  const index = session.index + 1;
  if (index >= session.questions.length) {
    return { ...session, phase: "finished", lastAnswer: null, finishedAt: now };
  }
  return { ...session, index, phase: "asking", lastAnswer: null };
}

/** Milliseconds on the clock; frozen once the session finished. */
export function elapsedMs(session: DrillSession, now: number): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

/** The result to save. Only a finished session has one. */
export function sessionSummary(session: DrillSession): SessionSummary {
  if (session.phase !== "finished") throw new RangeError("The session is not finished.");
  return summariseSession(session.results, elapsedMs(session, session.finishedAt ?? 0));
}
