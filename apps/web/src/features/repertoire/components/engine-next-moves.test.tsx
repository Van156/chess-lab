import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LINE_COLOURS } from "../lib/line-colours";
import EngineNextMoves, { type EngineNextMovesProps } from "./engine-next-moves";
import { engineLines } from "./repertoire.fixtures";

function render(overrides: Partial<EngineNextMovesProps> = {}) {
  return renderToStaticMarkup(
    <EngineNextMoves
      state={{ kind: "done", depth: 18, maxDepth: 18, lines: engineLines }}
      addPending={false}
      previewRank={null}
      onToggle={() => {}}
      onPreview={() => {}}
      onAdd={() => {}}
      onRetry={() => {}}
      {...overrides}
    />,
  );
}

describe("EngineNextMoves", () => {
  test("is a labelled section with a Stockfish switch, checked while the engine is on", () => {
    const html = render();
    expect(html).toContain('aria-labelledby="engine-next-moves-heading"');
    expect(html).toContain('id="engine-next-moves-heading"');
    expect(html).toContain("Engine · next move");
    expect(html).toMatch(/<label[^>]*>[\s\S]*role="switch"[\s\S]*Stockfish<\/label>/);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
  });

  test("off shows an unchecked switch, a hint and no lines", () => {
    const html = render({ state: { kind: "off" } });
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(html).toContain("Turn on Stockfish to see");
    expect(html).not.toContain("Engine tab");
    expect(html).not.toContain("<ol");
    expect(html).not.toContain("Depth");
  });

  test("starting shows a message and a skeleton, and no depth", () => {
    const html = render({ state: { kind: "starting" } });
    expect(html).toContain("Starting the engine");
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain("Depth");
  });

  test("analysing without lines shows a skeleton and the depth", () => {
    const html = render({ state: { kind: "analysing", depth: 1, maxDepth: 18, lines: [] } });
    expect(html).toContain('data-slot="skeleton"');
    expect(html).toContain("Depth 1/18");
    expect(html).not.toContain("<ol");
  });

  test("shows the depth and each line with Preview and Add, in its own list", () => {
    const html = render();
    expect(html).toContain("Depth 18/18");
    expect(html).toContain('data-slot="engine-next-lines"');
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain("Preview line 2, violet on the board");
    expect(html).toContain("Add d4");
    expect(html.match(/In repertoire/g)).toHaveLength(1);
  });

  test("marks each line with its number and the colour of its board arrow", () => {
    const html = render();
    expect(html.match(/data-slot="engine-line-swatch"/g)).toHaveLength(3);
    for (const entry of LINE_COLOURS.slice(0, 3)) {
      expect(html).toContain(`background-color:${entry.color}`);
    }
  });

  test("lists each line with its score text and its moves", () => {
    const html = render();
    expect(html).toContain("+0.34");
    expect(html).toContain("White is better by 0.34 pawns");
    expect(html).toContain("1. Nf3 d5 2. g3 Nf6");
  });

  test("marks only the previewed line as pressed and disables Add while saving", () => {
    const html = render({ previewRank: 1, addPending: true });
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Preview line 2/);
    const buttons = html.match(/<button[^>]*>Add [^<]+/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toMatch(/ disabled(="")?[ >]/);
    expect(render().match(/aria-pressed="true"/g)).toBeNull();
  });

  test("a finished search without lines says there is no suggestion", () => {
    const html = render({ state: { kind: "done", depth: 18, maxDepth: 18, lines: [] } });
    expect(html).toContain("no suggestion");
  });

  test("unavailable says so and offers Retry", () => {
    const html = render({ state: { kind: "unavailable" } });
    expect(html).toContain("The engine is unavailable right now");
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
  });

  test("a position without legal moves says so", () => {
    expect(render({ state: { kind: "terminal" } })).toContain("No legal moves in this position");
  });

  test("announces politely only when a search ends or the engine is unavailable", () => {
    expect(render()).toMatch(/<p role="status" class="sr-only">Analysis finished at depth 18\./);
    expect(render({ state: { kind: "unavailable" } })).toMatch(
      /role="status" class="sr-only">The engine is unavailable\./,
    );
    const analysing = render({
      state: { kind: "analysing", depth: 11, maxDepth: 18, lines: engineLines },
    });
    expect(analysing).toMatch(/role="status" class="sr-only"><\/p>/);
    expect(render({ state: { kind: "starting" } })).toMatch(/role="status" class="sr-only"><\/p>/);
  });
});
