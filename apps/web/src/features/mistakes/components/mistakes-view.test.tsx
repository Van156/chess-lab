import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { mistakeItem } from "./mistakes.fixtures";
import MistakesView, { type MistakesViewProps } from "./mistakes-view";

function render(overrides: Partial<MistakesViewProps> = {}) {
  return renderWithRouter(
    <MistakesView
      mistakes={[mistakeItem]}
      filteredByGame={false}
      hasMore={false}
      loadingMore={false}
      onLoadMore={() => {}}
      {...overrides}
    />,
  );
}

describe("MistakesView", () => {
  test("describes each mistake in words: severity, move, best move, loss, phase and opening", async () => {
    const html = await render();
    expect(html).toContain("Mistake: 2. a3");
    expect(html).toContain("Best was");
    expect(html).toContain("Nf3");
    expect(html).toContain("1.6 pawns lost");
    expect(html).toContain("Opening, King&#x27;s Pawn Game");
    expect(html).toContain("2026-10-04");
  });

  test("each mistake is a link to its detail", async () => {
    expect(await render()).toContain('href="/mistakes/m1"');
  });

  test("offers Load more only while another page exists, disabled while loading", async () => {
    expect(await render()).not.toContain("Load more mistakes");
    expect(await render({ hasMore: true })).toContain("Load more mistakes");
    expect(await render({ hasMore: true, loadingMore: true })).toMatch(
      /<button[^>]*\sdisabled=""[^>]*>Loading mistakes/,
    );
  });

  test("empty state differs for a single-game filter, which also offers the full list", async () => {
    expect(await render({ mistakes: [] })).toContain("once your games have been analysed");
    const filtered = await render({ mistakes: [], filteredByGame: true });
    expect(filtered).toContain("This game has no mistakes");
    expect(filtered).toContain("Show all mistakes");
  });
});
