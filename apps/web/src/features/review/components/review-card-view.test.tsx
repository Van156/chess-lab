import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { QueueItem } from "../lib/review-types";
import ReviewCardView, { type Attempt } from "./review-card-view";

const card: QueueItem = {
  cardId: "c1",
  pillar: "mistakes",
  state: 0,
  due: new Date("2026-10-04T10:00:00Z"),
  prompt: { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", orientation: "black" },
  answers: [{ san: "Nf3", uci: "g1f3" }],
  context: { playedSan: "a3", gameId: "g1", evalLossCp: 120, ply: 1 },
};

function render(options: { attempt?: Attempt | null; revealed?: boolean } = {}) {
  return renderToStaticMarkup(
    <ReviewCardView
      card={card}
      attempt={options.attempt ?? null}
      revealed={options.revealed ?? false}
      onMove={() => {}}
      onReveal={() => {}}
      onGrade={() => {}}
    />,
  );
}

describe("ReviewCardView before the answer", () => {
  const html = render();

  test("asks for the best move for the side the user played", () => {
    expect(html).toContain("Find the best move for Black");
    expect(html).toContain("Black to move: find the best move.");
  });

  test("offers a labelled move field and Show answer, and hides the answer and grades", () => {
    expect(html).toContain("Type a move");
    expect(html).toContain("Show answer");
    expect(html).not.toContain("Nf3");
    expect(html).not.toContain("Grade this card");
  });

  test("echoes an entered move without saying whether it was right", () => {
    const entered = render({ attempt: { san: "e4", correct: false } });
    expect(entered).toContain("Move entered: e4. Show the answer to check it.");
    expect(entered).not.toContain("not the best move");
  });
});

describe("ReviewCardView after the answer", () => {
  test("shows the best move and the game context, and removes the move field", () => {
    const html = render({ revealed: true });
    expect(html).toContain("Nf3");
    expect(html).toContain("You did not enter a move.");
    expect(html).toContain("you played a3 here and lost about");
    expect(html).toContain("1.2 pawns");
    expect(html).not.toContain("Show answer");
    expect(html).not.toContain("Type a move");
  });

  test("says whether the entered move was the best move", () => {
    expect(render({ revealed: true, attempt: { san: "Nf3", correct: true } })).toContain(
      "You played Nf3: that is the best move.",
    );
    expect(render({ revealed: true, attempt: { san: "e4", correct: false } })).toContain(
      "You played e4, not the best move.",
    );
  });

  test("offers four grade buttons in order, each at least 44 px, with key shortcuts", () => {
    const html = render({ revealed: true });
    const group = html.slice(html.indexOf('aria-label="Grade this card"'));
    const labels = [...group.matchAll(/<button[^>]*>(Again|Hard|Good|Easy)/g)].map((m) => m[1]);
    expect(labels).toEqual(["Again", "Hard", "Good", "Easy"]);
    expect([...group.matchAll(/<button[^>]*min-h-11/g)]).toHaveLength(4);
    expect([...group.matchAll(/aria-keyshortcuts="([1-4])"/g)].map((m) => m[1])).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });
});
