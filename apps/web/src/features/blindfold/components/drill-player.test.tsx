import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import { currentQuestion } from "../lib/drill-session";
import { describeExpected, describeQuestion } from "../lib/question-text";
import { answerForKey, isTypingTarget } from "./drill-answer-input";
import { askingSession, feedbackSession, MID_RUN_RESULTS } from "./drill-player.fixtures";
import DrillPlayer, { autoAdvances, isNextKey, pipStates } from "./drill-player";

const noop = () => {};

function renderPlayer(session: ReturnType<typeof askingSession>, elapsedMs = 65_000) {
  return renderWithRouter(
    <DrillPlayer
      label="Drill"
      session={session}
      elapsedMs={elapsedMs}
      onAnswer={noop}
      onNext={noop}
      onQuit={noop}
    />,
  );
}

/** The visible text of rendered markup, tags dropped. */
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&");

describe("DrillPlayer", () => {
  test("shows the level, progress, the timer and Quit on every kind", async () => {
    for (const { kind } of DRILL_CATALOG) {
      const session = askingSession(kind);
      const html = await renderPlayer(session);
      expect(html).toContain("Level 1");
      expect(textOf(html)).toContain("Question 3/20");
      expect(html).toContain('aria-valuetext="Question 3 of 20, 2 right so far"');
      expect(html).toContain(">1:05<");
      expect(html).toContain(">Quit<");
      expect(textOf(html)).toContain(describeQuestion(currentQuestion(session)));
    }
  });

  test("draws one progress pip per question: answered, current and upcoming", async () => {
    const html = await renderPlayer(askingSession("knight_distance", [true, false, true]));
    expect(html.match(/data-pip="/g)).toHaveLength(20);
    expect(html.match(/data-pip="correct"/g)).toHaveLength(2);
    expect(html.match(/data-pip="wrong"/g)).toHaveLength(1);
    expect(html.match(/data-pip="current"/g)).toHaveLength(1);
    expect(html.match(/data-pip="upcoming"/g)).toHaveLength(16);
  });

  test("sets the squares in the prompt as mono chips", async () => {
    const session = askingSession("knight_distance");
    const question = currentQuestion(session);
    if (question.kind !== "knight_distance") throw new Error("unexpected kind");
    const html = await renderPlayer(session);
    expect(html).toMatch(new RegExp(`font-mono[^>]*>${question.from}</span>`));
    expect(html).toMatch(new RegExp(`font-mono[^>]*>${question.to}</span>`));
  });

  test("shows the streak from three right answers in a row", async () => {
    expect(await renderPlayer(askingSession("square_colour", [true, true]))).not.toContain(
      "right in a row",
    );
    const html = await renderPlayer(askingSession("square_colour", MID_RUN_RESULTS));
    expect(html).toContain('aria-label="5 right in a row"');
  });

  test("the live region stays empty while a question is asked", async () => {
    const html = await renderPlayer(askingSession("square_colour"));
    expect(html).toContain('role="status" aria-live="polite" class="sr-only"></p>');
  });

  test("square colour offers Light and Dark squares with their shortcuts", async () => {
    const html = await renderPlayer(askingSession("square_colour"));
    expect(html).toContain('aria-label="Square colour"');
    expect(html).toContain("Light");
    expect(html).toContain("Dark");
    expect(html).toContain('aria-keyshortcuts="L"');
    expect(html).toContain('aria-keyshortcuts="D"');
  });

  test("coordinates shows an unlabelled board and a square-name input", async () => {
    const html = await renderPlayer(askingSession("coordinates"));
    expect(html).toContain('aria-label="Empty board with one highlighted square"');
    expect(html).not.toContain("<text");
    expect(html).toContain('for="drill-answer"');
    expect(html).toContain("Square name");
    expect(html).toContain('aria-describedby="drill-prompt drill-answer-hint"');
    expect(html).toContain(">Enter<");
  });

  test("diagonals asks for typed squares in any order", async () => {
    const html = await renderPlayer(askingSession("diagonals"));
    expect(html).toContain("Squares on the diagonal");
    expect(html).toContain("in any order");
  });

  test("knight distance offers the numbers 0 to 6, each with its key", async () => {
    const html = await renderPlayer(askingSession("knight_distance"));
    for (const count of [0, 1, 2, 3, 4, 5, 6]) {
      expect(html).toContain(`aria-keyshortcuts="${count}"`);
      expect(html).toMatch(new RegExp(`>${count}</button>`));
    }
    expect(html).not.toContain(">7</button>");
  });

  test("wrong feedback names the right answer and the given one, and offers Next", async () => {
    const session = feedbackSession("square_colour");
    const html = await renderPlayer(session);
    expect(html).toContain(
      `aria-live="polite" class="sr-only">Incorrect. The answer is ${describeExpected(currentQuestion(session))}.<`,
    );
    expect(textOf(html)).toContain(`Answer:${describeExpected(currentQuestion(session))}`);
    expect(textOf(html)).toContain("You said:");
    expect(html).toContain(">Next<");
    expect(html).toContain(">Enter<");
    expect(html).not.toContain('aria-label="Square colour"');
  });

  test("right feedback says so without repeating the answer given", async () => {
    const html = await renderPlayer(feedbackSession("knight_distance", { correct: true }));
    expect(html).toContain('class="sr-only">Correct.<');
    expect(html).not.toContain("You said:");
  });

  test("feedback reveals a board for each of the original drills", async () => {
    const reveals = {
      square_colour: "highlighted, a",
      coordinates: "highlighted and named",
      diagonals: "Board with the diagonal",
      knight_distance: "Board with a shortest knight route",
    } as const;
    for (const [kind, label] of Object.entries(reveals)) {
      const html = await renderPlayer(feedbackSession(kind as keyof typeof reveals));
      expect(html).toContain(label);
    }
  });

  test("the diagonal reveal marks the squares named in error and the ones missed", async () => {
    const html = await renderPlayer(feedbackSession("diagonals"));
    expect(html).toContain('data-mark="wrong"');
    expect(html).toContain('data-mark="missed"');
    expect(html).toContain("squares named in error");
  });

  test("the knight reveal draws the route as arrows", async () => {
    const session = feedbackSession("knight_distance");
    const question = currentQuestion(session);
    if (question.kind !== "knight_distance") throw new Error("unexpected kind");
    const html = await renderPlayer(session);
    expect(html.match(/<polyline/g)).toHaveLength(question.expected);
    expect(textOf(html)).toContain("One shortest route:");
  });

  test("the last question finishes instead of moving on", async () => {
    const session = feedbackSession("coordinates");
    const last = { ...session, index: session.questions.length - 1 };
    const html = await renderPlayer({ ...last, results: Array<boolean>(20).fill(false) });
    expect(html).toContain(">Finish<");
  });

  test("renders every kind in feedback", async () => {
    for (const { kind } of DRILL_CATALOG) {
      expect(await renderPlayer(feedbackSession(kind))).toContain(">Next<");
    }
  });
});

describe("keyboard", () => {
  test("square colour answers with L and D, in either case", () => {
    expect(answerForKey("square_colour", "l")).toBe("light");
    expect(answerForKey("square_colour", "D")).toBe("dark");
    expect(answerForKey("square_colour", "x")).toBeNull();
  });

  test("knight distance answers with the digits 0 to 6 only", () => {
    expect(answerForKey("knight_distance", "0")).toBe(0);
    expect(answerForKey("knight_distance", "6")).toBe(6);
    expect(answerForKey("knight_distance", "7")).toBeNull();
    expect(answerForKey("knight_distance", "l")).toBeNull();
  });

  test("typed drills take no single-key answers", () => {
    expect(answerForKey("coordinates", "e")).toBeNull();
    expect(answerForKey("diagonals", "1")).toBeNull();
  });

  test("Enter and Space move past feedback", () => {
    expect(isNextKey("Enter")).toBe(true);
    expect(isNextKey(" ")).toBe(true);
    expect(isNextKey("n")).toBe(false);
  });

  test("keys typed into a field are left alone", () => {
    expect(isTypingTarget({ target: { tagName: "INPUT" } as unknown as EventTarget })).toBe(true);
    expect(isTypingTarget({ target: { tagName: "BUTTON" } as unknown as EventTarget })).toBe(false);
    expect(isTypingTarget({ target: null })).toBe(false);
  });
});

describe("autoAdvances and pipStates", () => {
  test("only right answers in the speed drills move on by themselves", () => {
    expect(autoAdvances("square_colour", true, 700)).toBe(true);
    expect(autoAdvances("same_diagonal", true, 700)).toBe(true);
    expect(autoAdvances("square_colour", false, 700)).toBe(false);
    expect(autoAdvances("square_colour", true, null)).toBe(false);
    expect(autoAdvances("knight_distance", true, 700)).toBe(false);
  });

  test("the answered question shows its result during feedback", () => {
    const states = pipStates(feedbackSession("square_colour"));
    expect(states.slice(0, 4)).toEqual(["correct", "correct", "wrong", "upcoming"]);
  });
});
