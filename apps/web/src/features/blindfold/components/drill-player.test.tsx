import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import { currentQuestion } from "../lib/drill-session";
import { describeExpected, describeQuestion } from "../lib/question-text";
import { askingSession, FINISHED_SUMMARY, feedbackSession } from "./drill-player.fixtures";
import BlindfoldDrills from "./blindfold-drills";
import DrillPlayer from "./drill-player";
import DrillResults from "./drill-results";

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

describe("DrillPlayer", () => {
  test("shows progress, the timer and Quit on every kind", async () => {
    for (const { kind } of DRILL_CATALOG) {
      const html = await renderPlayer(askingSession(kind));
      expect(html).toContain("Question 3/20");
      expect(html).toContain(">1:05<");
      expect(html).toContain(">Quit<");
      expect(html).toContain(describeQuestion(currentQuestion(askingSession(kind))));
    }
  });

  test("square colour offers Light and Dark with their shortcuts", async () => {
    const html = await renderPlayer(askingSession("square_colour"));
    expect(html).toContain("Light");
    expect(html).toContain("Dark");
    expect(html).toContain('aria-keyshortcuts="L"');
    expect(html).toContain('aria-keyshortcuts="D"');
  });

  test("coordinates shows an unlabelled empty board and a square-name input", async () => {
    const html = await renderPlayer(askingSession("coordinates"));
    expect(html).toContain("Empty board with one highlighted square");
    expect(html).toContain('for="drill-answer"');
    expect(html).toContain("Square name");
  });

  test("diagonals asks for typed squares in any order", async () => {
    const html = await renderPlayer(askingSession("diagonals"));
    expect(html).toContain("Squares on the diagonal");
    expect(html).toContain("in any order");
  });

  test("knight distance offers the numbers 0 to 6", async () => {
    const html = await renderPlayer(askingSession("knight_distance"));
    for (const count of [0, 1, 2, 3, 4, 5, 6]) {
      expect(html).toContain(`>${count}</button>`);
    }
    expect(html).not.toContain(">7</button>");
  });

  test("feedback names the right answer and offers Next", async () => {
    const session = feedbackSession("square_colour");
    const html = await renderPlayer(session);
    expect(html).toContain("Incorrect.");
    expect(html).toContain(describeExpected(currentQuestion(session)));
    expect(html).toContain(">Next<");
    expect(html).not.toContain('aria-label="Square colour"');
  });
});

describe("BlindfoldDrills", () => {
  test("gives each drill a level selector and a Start button", async () => {
    const html = await renderWithRouter(<BlindfoldDrills drills={DRILL_CATALOG} onStart={noop} />);
    for (const drill of DRILL_CATALOG) {
      expect(html).toContain(`aria-label="${drill.label} level"`);
    }
    expect(html.match(/>Level 1</g)).toHaveLength(4);
    expect(html.match(/>Level 3</g)).toHaveLength(4);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(4);
    expect(html.match(/>Start</g)).toHaveLength(4);
  });
});

describe("DrillResults", () => {
  test("shows correct, accuracy and time with the follow-up actions", async () => {
    const html = await renderWithRouter(
      <DrillResults label="Drill" summary={FINISHED_SUMMARY} onPlayAgain={noop} onBack={noop} />,
    );
    expect(html).toContain(">17/20<");
    expect(html).toContain(">85%<");
    expect(html).toContain(">1:23<");
    expect(html).toContain("Play again");
    expect(html).toContain("Back to drills");
  });
});
