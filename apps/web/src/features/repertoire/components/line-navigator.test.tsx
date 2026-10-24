import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import LineNavigator, { type LineNavigatorProps } from "./line-navigator";
import { e4Move, e5Move } from "./repertoire.fixtures";

function render(overrides: Partial<LineNavigatorProps> = {}) {
  return renderToStaticMarkup(
    <LineNavigator path={[e4Move]} onSelectPly={() => {}} onDelete={() => {}} {...overrides} />,
  );
}

describe("LineNavigator", () => {
  test("shows breadcrumbs back to the start, marking the current position", () => {
    const html = render({ path: [e4Move, e5Move] });
    expect(html).toContain('aria-label="Path to this position"');
    expect(html).toContain(">Start</button>");
    expect(html).toContain("1. e4");
    expect(html.match(/aria-current="location"/g)).toHaveLength(1);
  });

  test("marks the start as current when no move was played", () => {
    const html = render({ path: [] });
    expect(html).toMatch(/aria-current="location"[^>]*>Start</);
  });

  test("offers to delete the last move of the path", () => {
    const html = render();
    expect(html).toContain("Delete this move");
  });

  test("has no delete-this-move at the start", () => {
    expect(render({ path: [] })).not.toContain("Delete this move");
  });
});
