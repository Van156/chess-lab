import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import type { GameItem } from "../lib/games-types";
import GamesView, { type GamesViewProps } from "./games-view";

const game: GameItem = {
  id: "g1",
  lichessGameId: "abcd1234",
  userColor: "black",
  speed: "blitz",
  rated: true,
  result: "0-1",
  eco: "B20",
  openingName: "Sicilian Defense",
  playedAt: new Date("2026-10-04T18:20:00Z"),
  importedAt: new Date("2026-10-05T08:00:00Z"),
  analysisStatus: "screening",
};

function render(overrides: Partial<GamesViewProps> = {}) {
  return renderToStaticMarkup(
    <GamesView
      games={[game]}
      importedCount={1}
      sync={<p role="status">Last synced 5 min ago</p>}
      hasMore={false}
      loadingMore={false}
      onLoadMore={() => {}}
      showMistakesLink={false}
      {...overrides}
    />,
  );
}

describe("GamesView", () => {
  test("lists each game with its outcome from the user's side and its analysis status in words", () => {
    const html = render();
    expect(html).toContain('aria-label="Imported games"');
    expect(html).toContain("Win");
    expect(html).toContain("as Black");
    expect(html).toContain("Blitz, rated, Sicilian Defense");
    expect(html).toContain("2026-10-04");
    expect(html).toContain("Analysing");
  });

  test("shows the sync slot and the imported count", () => {
    const html = render({ importedCount: 84 });
    expect(html).toContain("Last synced 5 min ago");
    expect(html).toContain("84 games imported");
    expect(render({ importedCount: 1 })).toContain("1 game imported");
  });

  test("offers Load more only while another page exists, and disables it while loading", () => {
    expect(render()).not.toContain("Load more games");
    expect(render({ hasMore: true })).toContain("Load more games");
    expect(render({ hasMore: true, loadingMore: true })).toMatch(
      /<button[^>]*\sdisabled=""[^>]*>Loading games/,
    );
  });

  test("a failed next page keeps the loaded games, announces the error and offers a retry", () => {
    const html = render({ hasMore: true, loadMoreFailed: true });
    expect(html).toContain("Imported games");
    expect(html).toContain('role="alert"');
    expect(html).toContain("More games could not be loaded.");
    expect(html).toContain("Try again");
  });

  test("shows the empty state, still with the sync slot, when nothing was imported", () => {
    const html = render({ games: [], importedCount: 0 });
    expect(html).toContain("No games yet");
    expect(html).toContain("Last synced 5 min ago");
    expect(html).not.toContain("Imported games");
  });

  test("hides the mistakes link while the pillar is off", () => {
    expect(render({ games: [{ ...game, analysisStatus: "complete" }] })).not.toContain(
      "View mistakes",
    );
  });

  test("links an analysed game to its mistakes when the pillar is on, and no other game", async () => {
    const analysed = { ...game, id: "g9", analysisStatus: "complete" } as const;
    const html = await renderWithRouter(
      <GamesView
        games={[analysed, game]}
        sync={null}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => {}}
        showMistakesLink
      />,
    );
    expect(html).toContain('href="/mistakes?gameId=g9"');
    expect(html.match(/View mistakes/g)).toHaveLength(1);
  });
});
