import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ExplorerPanel, { type ExplorerPanelProps } from "./explorer-panel";
import {
  e5Move,
  explorerEmpty,
  explorerOk,
  explorerStale,
  explorerUnavailable,
} from "./repertoire.fixtures";

function render(overrides: Partial<ExplorerPanelProps> = {}) {
  return renderToStaticMarkup(
    <ExplorerPanel
      state={{ kind: "loaded", data: explorerOk }}
      childMoves={[e5Move]}
      {...overrides}
    />,
  );
}

describe("ExplorerPanel", () => {
  test("shows the rating band, the speeds and the opening name as text", () => {
    const html = render();
    expect(html).toContain(">Explorer</h2>");
    expect(html).toContain("Rating band 1600–1799 · blitz, rapid, classical");
    expect(html).toContain("B00 King&#x27;s Pawn Game");
  });

  test("lists the moves in a table with column headers", () => {
    const html = render();
    for (const header of ["Move", "Games", "White", "Draws", "Black"]) {
      expect(html).toMatch(new RegExp(`<th[^>]*scope="col"[^>]*>${header}</th>`));
    }
    expect(html).toContain("Moves played from this position");
    expect(html).toContain("4,000");
  });

  test("gives the results as percentages in text", () => {
    const html = render();
    // c5: 2100 / 1200 / 700 of 4000
    expect(html).toContain(">53%</td>");
    expect(html).toContain(">30%</td>");
    expect(html).toContain(">17%</td>");
  });

  test("keeps the stacked bar out of the accessibility tree", () => {
    expect(render().match(/aria-hidden="true"/g)).toHaveLength(3);
  });

  test("marks only the moves already in the repertoire", () => {
    const html = render();
    expect(html.match(/In repertoire/g)).toHaveLength(1);
    expect(html).toMatch(/>e5<\/span><span[^>]*>In repertoire/);
  });

  test("notes that saved stats are a copy", () => {
    expect(render()).not.toContain("saved results");
    expect(render({ state: { kind: "loaded", data: explorerStale } })).toContain(
      "saved results because Lichess did not answer",
    );
  });

  test("says so when no game was recorded", () => {
    const html = render({ state: { kind: "loaded", data: explorerEmpty } });
    expect(html).toContain("No games recorded in this position for this rating band.");
    expect(html).not.toContain("<table");
  });

  test("explains each unavailable reason and shows no table", () => {
    const html = render({
      state: { kind: "loaded", data: explorerUnavailable("unauthorized") },
    });
    expect(html).toContain("sign in with Lichess again");
    expect(html).not.toContain("<table");
    expect(
      render({ state: { kind: "loaded", data: explorerUnavailable("rate_limited") } }),
    ).toContain("Lichess is busy");
  });

  test("treats a failed request as unavailable", () => {
    expect(render({ state: { kind: "failed" } })).toContain("unavailable right now");
  });

  test("has an accessible loading state", () => {
    const html = render({ state: { kind: "loading" } });
    expect(html).toContain('aria-label="Loading explorer stats"');
    expect(html).not.toContain("<table");
  });

  test("leaves room for a band control and a per-move action", () => {
    const html = render({
      bandControl: <span>band select</span>,
      moveAction: (move) => <button type="button">Add {move.san}</button>,
    });
    expect(html).toContain("band select");
    expect(html).toContain("Add c5");
    expect(html).toContain("Actions");
  });
});
