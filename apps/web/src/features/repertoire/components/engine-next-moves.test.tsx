import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import EngineNextMoves, { type EngineNextMovesProps } from "./engine-next-moves";
import { engineLines } from "./repertoire.fixtures";

function render(overrides: Partial<EngineNextMovesProps> = {}) {
  return renderToStaticMarkup(
    <EngineNextMoves
      state={{ kind: "done", depth: 18, maxDepth: 18, lines: engineLines }}
      addPending={false}
      previewRank={null}
      onPreview={() => {}}
      onAdd={() => {}}
      {...overrides}
    />,
  );
}

describe("EngineNextMoves", () => {
  test("is a labelled section whose heading id does not clash with the Engine tab", () => {
    const html = render();
    expect(html).toContain('aria-labelledby="engine-next-moves-heading"');
    expect(html).toContain('id="engine-next-moves-heading"');
    expect(html).not.toContain('id="engine-heading"');
    expect(html).toContain("Engine · next move");
  });

  test("shows the depth and each line with Preview and Add, in its own list", () => {
    const html = render();
    expect(html).toContain("Depth 18/18");
    expect(html).toContain('data-slot="engine-next-lines"');
    expect(html).not.toContain('data-slot="engine-lines"');
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain("Preview line 2, violet on the board");
    expect(html).toContain("Add d4");
    expect(html).toContain("In repertoire");
  });

  test("marks the previewed line and disables Add while saving", () => {
    const html = render({ previewRank: 1, addPending: true });
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    for (const button of html.match(/<button[^>]*>Add [^<]+/g) ?? []) {
      expect(button).toMatch(/ disabled(="")?[ >]/);
    }
  });

  test("off points to the Engine tab and shows no lines", () => {
    const html = render({ state: { kind: "off" } });
    expect(html).toContain("Engine tab");
    expect(html).not.toContain("<ol");
    expect(html).not.toContain("Depth");
  });

  test("starting, or analysing without lines, shows a skeleton", () => {
    expect(render({ state: { kind: "starting" } })).toContain('data-slot="skeleton"');
    const html = render({ state: { kind: "analysing", depth: 1, maxDepth: 18, lines: [] } });
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain("<ol");
  });

  test("a finished search without lines says there is no suggestion", () => {
    const html = render({ state: { kind: "done", depth: 18, maxDepth: 18, lines: [] } });
    expect(html).toContain("no suggestion");
  });

  test("renders nothing when the engine is unavailable or the position is terminal", () => {
    expect(render({ state: { kind: "unavailable" } })).toBe("");
    expect(render({ state: { kind: "terminal" } })).toBe("");
  });
});
