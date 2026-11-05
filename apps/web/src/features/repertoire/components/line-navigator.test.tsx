import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import LineNavigator, { type LineNavigatorProps } from "./line-navigator";
import { c5Move, e4Move, e5Move } from "./repertoire.fixtures";

function render(overrides: Partial<LineNavigatorProps> = {}) {
  return renderToStaticMarkup(
    <LineNavigator
      path={[e4Move]}
      basePositionId={null}
      onSelectPly={() => {}}
      onDelete={() => {}}
      keysActive
      {...overrides}
    />,
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

  describe("with a base line", () => {
    const nf3 = { ...e5Move, id: "m9", fromPositionId: "p2", toPositionId: "p9", san: "Nf3" };

    test("collapses the base moves into one chip after Start", () => {
      const html = render({ path: [e4Move, e5Move, nf3], basePositionId: "p2" });
      expect(html).toContain(">Start</button>");
      expect(html).toContain('aria-label="Base line: 1. e4 e5"');
      expect(html).toContain(">Base</button>");
      expect(html).not.toContain("1. e4</button>");
      expect(html).toContain("2. Nf3");
      expect(html.indexOf(">Start<")).toBeLessThan(html.indexOf(">Base<"));
    });

    test("marks the Base chip as the location at the base position", () => {
      const html = render({ path: [e4Move, e5Move], basePositionId: "p2" });
      expect(html).toMatch(
        /aria-current="location"[^>]*aria-label="Base line|aria-label="Base line[^>]*aria-current="location"/,
      );
      expect(html.match(/aria-current="location"/g)).toHaveLength(1);
    });

    test("keeps the true start one tap away, marked at the start", () => {
      const html = render({ path: [], basePositionId: "p2" });
      expect(html).toMatch(/aria-current="location"[^>]*>Start</);
      expect(html).not.toContain(">Base</button>");
    });

    test("shows every move of a line that does not pass through the base", () => {
      const html = render({ path: [e4Move, c5Move], basePositionId: "p2" });
      expect(html).toContain("1. e4");
      expect(html).toContain("1... c5");
      expect(html).not.toContain(">Base</button>");
    });
  });

  test("hints at the arrow keys and declares them while they walk the tree", () => {
    const html = render();
    expect(html).toContain('aria-keyshortcuts="ArrowLeft ArrowRight Home End"');
    expect(html).toContain("Use ← and → to step through the line, Home and End to jump.");
  });

  test("drops the hint and the shortcuts while a preview owns the arrows", () => {
    const html = render({ keysActive: false });
    expect(html).not.toContain("aria-keyshortcuts");
    expect(html).not.toContain("Home and End");
  });
});
