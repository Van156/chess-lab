import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import MistakeDetailView from "./mistake-detail-view";
import { mistakeDetail } from "./mistakes.fixtures";

const moves = ["e4", "e5", "a3"];

function render(mistake = mistakeDetail, list: readonly string[] = moves) {
  return renderWithRouter(<MistakeDetailView mistake={mistake} moves={list} />);
}

describe("MistakeDetailView", async () => {
  const html = await render();

  test("describes the board position and both arrows for assistive technology", () => {
    expect(html).toContain("Chess position before your move. White to move.");
    expect(html).toContain("red arrow: you played a3. green arrow: best move Nf3.");
  });

  test("states played versus best with evaluations from the user's side", () => {
    expect(html).toContain("You played");
    expect(html).toContain("2. a3");
    expect(html).toContain("Best move");
    expect(html).toContain("+0.4");
    expect(html).toContain("-1.2");
    expect(html).toContain("1.6 pawns");
    expect(html).toContain("Clock left");
    expect(html).toContain("1:35");
  });

  test("lists the game's moves with the position before the mistake as current", () => {
    expect(html).toContain('aria-label="Moves"');
    expect(html).toContain("Current move: 1... e5");
  });

  test("links to the game on Lichess in a new tab and to the game's other mistakes", () => {
    expect(html).toContain('href="https://lichess.org/abcd1234"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("(opens in a new tab)");
    expect(html).toContain("More mistakes from this game");
  });

  test("omits the clock and opening rows when there is no data", async () => {
    const bare = await render({
      ...mistakeDetail,
      clockLeftMs: null,
      openingName: null,
      eco: null,
    });
    expect(bare).not.toContain("Clock left");
    expect(bare).not.toContain(">Opening</dt>");
  });

  test("spells out a forced mate instead of a pawn value", async () => {
    expect(await render({ ...mistakeDetail, evalAfterCp: -1000 })).toContain("Mate against you");
  });

  test("still renders without a move list when the PGN could not be read", async () => {
    expect(await render(mistakeDetail, [])).toContain("No moves yet");
  });
});
