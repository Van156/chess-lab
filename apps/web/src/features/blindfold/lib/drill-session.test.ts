import { describe, expect, test } from "bun:test";

import {
  answerQuestion,
  currentQuestion,
  elapsedMs,
  nextQuestion,
  sessionSummary,
  startSession,
} from "./drill-session";
import { generateQuestions } from "./questions";

const start = (count = 3) =>
  startSession({ kind: "square_colour", level: 1, seed: 7, count, now: 1_000 });

describe("startSession", () => {
  test("asks the first of the generated questions", () => {
    const session = start();
    expect(session.phase).toBe("asking");
    expect(session.index).toBe(0);
    expect(session.questions).toEqual(
      generateQuestions({ kind: "square_colour", level: 1, seed: 7, count: 3 }),
    );
    expect(currentQuestion(session)).toBe(session.questions[0]);
  });

  test("defaults to a 20-question session", () => {
    expect(startSession({ kind: "coordinates", level: 1, seed: 1, now: 0 }).questions).toHaveLength(
      20,
    );
  });
});

describe("answerQuestion", () => {
  test("records the right answer and moves to feedback", () => {
    const session = start();
    const question = currentQuestion(session);
    const answered = answerQuestion(session, question.expected as string);
    expect(answered.phase).toBe("feedback");
    expect(answered.results).toEqual([true]);
    expect(answered.lastAnswer).toBe(question.expected as string);
  });

  test("records a wrong answer", () => {
    const session = start();
    const wrong = currentQuestion(session).expected === "light" ? "dark" : "light";
    expect(answerQuestion(session, wrong).results).toEqual([false]);
  });

  test("ignores a second answer while feedback is showing", () => {
    const answered = answerQuestion(start(), "light");
    expect(answerQuestion(answered, "dark")).toBe(answered);
  });
});

describe("nextQuestion", () => {
  test("advances to the next question and clears the last answer", () => {
    const next = nextQuestion(answerQuestion(start(), "light"), 2_000);
    expect(next.phase).toBe("asking");
    expect(next.index).toBe(1);
    expect(next.lastAnswer).toBeNull();
  });

  test("does nothing while a question is still unanswered", () => {
    const session = start();
    expect(nextQuestion(session, 2_000)).toBe(session);
  });

  test("finishes after the last question and freezes the clock", () => {
    let session = start(2);
    session = nextQuestion(answerQuestion(session, "light"), 2_000);
    session = nextQuestion(answerQuestion(session, "light"), 5_000);
    expect(session.phase).toBe("finished");
    expect(session.finishedAt).toBe(5_000);
    expect(elapsedMs(session, 99_000)).toBe(4_000);
  });
});

describe("elapsedMs and sessionSummary", () => {
  test("runs from the start while the session is open", () => {
    expect(elapsedMs(start(), 3_500)).toBe(2_500);
  });

  test("summarises correct, total and duration", () => {
    let session = start(2);
    const first = currentQuestion(session).expected as string;
    session = nextQuestion(answerQuestion(session, first), 2_000);
    session = nextQuestion(answerQuestion(session, "nonsense"), 4_000);
    expect(sessionSummary(session)).toEqual({ correct: 1, total: 2, durationMs: 3_000 });
  });

  test("refuses to summarise an unfinished session", () => {
    expect(() => sessionSummary(start())).toThrow(RangeError);
  });
});
