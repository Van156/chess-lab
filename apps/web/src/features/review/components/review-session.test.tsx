import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { SessionSummary } from "../lib/review-queue";
import type { QueueItem } from "../lib/review-types";
import ReviewSession, { type ReviewSessionProps } from "./review-session";
import SessionSummaryView from "./session-summary";

const card: QueueItem = {
  cardId: "c1",
  pillar: "mistakes",
  state: 2,
  due: new Date("2026-10-04T10:00:00Z"),
  prompt: { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", orientation: "white" },
  answers: [{ san: "e4", uci: "e2e4" }],
  context: { playedSan: "a3", gameId: "g1", evalLossCp: 90, ply: 1 },
};
const summary: SessionSummary = {
  cards: 3,
  answers: 4,
  byGrade: { 1: 1, 2: 0, 3: 2, 4: 1 },
  durationMs: 125_000,
};

function render(props: Partial<ReviewSessionProps> = {}) {
  return renderToStaticMarkup(
    <ReviewSession
      phase="card"
      card={card}
      progress={{ done: 2, total: 9 }}
      summary={summary}
      onGrade={() => {}}
      onRetryPage={() => {}}
      doneAction={<a href="/today">Back to Today</a>}
      {...props}
    />,
  );
}

describe("ReviewSession", () => {
  test("shows the card with an accessible progress bar", () => {
    const html = render();
    expect(html).toContain("<h1");
    expect(html).toContain("Find the best move for White");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("Review progress: 2 of 9 answered");
  });

  test("announces that more cards are loading", () => {
    const html = render({ phase: "waiting", card: null });
    expect(html).toMatch(/role="status"[^>]*>Loading more cards/);
  });

  test("reports a paging failure with a retry button and reassures about saved grades", () => {
    const html = render({ phase: "failed", card: null });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Your grades so far are saved");
    expect(html).toMatch(/<button[^>]*min-h-11[^>]*>Try again/);
  });

  test("shows the summary instead of the progress bar when done", () => {
    const html = render({ phase: "done", card: null });
    expect(html).toContain("Session complete");
    expect(html).toContain("Back to Today");
    expect(html).not.toContain('role="progressbar"');
  });
});

describe("SessionSummary", () => {
  test("lists cards, time and every grade count", () => {
    const html = renderToStaticMarkup(<SessionSummaryView summary={summary} action={null} />);
    expect(html).toContain("3 cards reviewed in 2 min.");
    for (const [label, count] of [
      ["Again", 1],
      ["Hard", 0],
      ["Good", 2],
      ["Easy", 1],
    ] as const) {
      expect(html).toMatch(new RegExp(`${label}</dt><dd[^>]*>${count}</dd>`));
    }
  });

  test("uses the singular for one card", () => {
    const html = renderToStaticMarkup(
      <SessionSummaryView summary={{ ...summary, cards: 1, answers: 1 }} action={null} />,
    );
    expect(html).toContain("1 card reviewed");
  });

  test("an empty session says there is nothing to review", () => {
    const html = renderToStaticMarkup(
      <SessionSummaryView
        summary={{ ...summary, cards: 0, answers: 0, durationMs: 0 }}
        action={null}
      />,
    );
    expect(html).toContain("Nothing to review");
    expect(html).not.toContain("<dl");
  });
});
