import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { buildVariationTree } from "../lib/variation-tree";
import { forkGraph, forkGraphPath, openGameGraph } from "./repertoire.fixtures";
import VariationTree, { type VariationTreeProps } from "./variation-tree";

const pathOf = (ids: string[]) =>
  ids
    .map((id) => forkGraph.moves.find((move) => move.id === id))
    .filter((move) => move !== undefined);

function render(overrides: Partial<VariationTreeProps> = {}) {
  return renderToStaticMarkup(
    <VariationTree
      tree={buildVariationTree(forkGraph, pathOf(forkGraphPath))}
      startPositionId="p0"
      atStart={false}
      onSelect={() => {}}
      onDelete={() => {}}
      {...overrides}
    />,
  );
}

describe("VariationTree", () => {
  test("starts with a Start position row, marked as current at the start", () => {
    expect(render()).toContain(">Start position</button>");
    expect(render({ atStart: true })).toMatch(/aria-current="location"[^>]*>Start position</);
  });

  test("explains an empty repertoire", () => {
    const html = render({ tree: buildVariationTree({ startPositionId: "p0", moves: [] }, []) });
    expect(html).toContain("No moves yet");
  });

  test("marks only the last move of the shown line as the current location", () => {
    const html = render();
    expect(html.match(/aria-current="location"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-label="2\. Nc3[^"]*" aria-current="location"/);
  });

  test("shows alternatives in a labelled group and names them as alternatives", () => {
    const html = render();
    expect(html).toContain('aria-label="Alternatives to 1. e4"');
    expect(html).toContain('aria-label="1... c5, opponent reply, alternative to 1... e5"');
    // The nested alternative at 1... c5 is a second level of the same grouping.
    expect(html).toContain('aria-label="Alternatives to 2. Nf3"');
    expect(html).toContain('aria-label="2. Nc3, your move, alternative to 2. Nf3"');
  });

  test("keeps only-child chains flat, without a group", () => {
    const html = renderToStaticMarkup(
      <VariationTree
        tree={buildVariationTree(
          { startPositionId: "p0", moves: openGameGraph.moves.slice(0, 2) },
          [],
        )}
        startPositionId="p0"
        atStart
        onSelect={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(html).toContain('aria-label="1... e5, opponent reply"');
    expect(html).not.toContain("Alternatives to");
  });

  test("marks a transposition leaf", () => {
    const html = render();
    expect(html).toContain("transposition to a position shown above");
    expect(html).toContain(">transposition<");
  });

  test("offers a fold toggle on a fork and a delete button on every move", () => {
    const html = render();
    expect(html).toContain('aria-label="Hide alternatives to 1. e4"');
    expect(html).toContain('aria-label="Delete 1. e4 and its continuations"');
    expect(html).toContain('aria-label="Delete 2. Nc3 and its continuations"');
  });

  test("cannot fold a fork the shown line runs through, but can fold the others", () => {
    const html = render();
    const toggle = (label: string) =>
      html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
    expect(toggle("Hide alternatives to 1\\. e4")).not.toContain('disabled=""');
    expect(toggle("Hide alternatives to 1\\.\\.\\. e5")).toContain('disabled=""');
  });
});
