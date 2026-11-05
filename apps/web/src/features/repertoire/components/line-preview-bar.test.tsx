import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LINE_COLOURS } from "../lib/line-colours";
import type { PreviewView } from "../lib/line-preview";
import LinePreviewBar, { type LinePreviewBarProps } from "./line-preview-bar";

const view: PreviewView = {
  rank: 1,
  fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  san: "e5",
  lastMove: { from: "e7", to: "e5" },
  nextArrow: { from: "g1", to: "f3" },
  cursor: 2,
  total: 4,
  canPrevious: true,
  canNext: true,
};

function render(overrides: Partial<LinePreviewBarProps> = {}) {
  return renderToStaticMarkup(
    <LinePreviewBar
      view={view}
      onPrevious={() => {}}
      onNext={() => {}}
      onExit={() => {}}
      {...overrides}
    />,
  );
}

describe("LinePreviewBar", () => {
  test("says which line is previewed and how far along, in words", () => {
    const html = render();
    expect(html).toContain("Previewing line 2");
    expect(html).toContain("move 2 of 4 (e5)");
    expect(html).toMatch(/role="status"/);
  });

  test("shows the line's colour as a swatch", () => {
    expect(render()).toContain(`background-color:${LINE_COLOURS[1]?.color}`);
  });

  test("has labelled step buttons and a way back to the branch start", () => {
    const html = render();
    expect(html).toContain('aria-label="Previous move in the line"');
    expect(html).toContain('aria-label="Next move in the line"');
    expect(html).toContain(">Back to branch start</button>");
  });

  test("keeps every control at least 44px", () => {
    const html = render();
    expect(html.match(/min-h-11/g)).toHaveLength(3);
  });

  test("disables the step that has nowhere to go", () => {
    const button = (html: string, label: string) =>
      html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
    const first = render({ view: { ...view, cursor: 1, canPrevious: false } });
    expect(button(first, "Previous move in the line")).toContain('disabled=""');
    expect(button(first, "Next move in the line")).not.toContain('disabled=""');
    const last = render({ view: { ...view, cursor: 4, canNext: false } });
    expect(button(last, "Next move in the line")).toContain('disabled=""');
  });
});
