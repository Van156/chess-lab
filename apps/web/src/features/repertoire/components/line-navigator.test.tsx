import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import LineNavigator, { type LineNavigatorProps } from "./line-navigator";
import { c5Move, e4Move, e5Move } from "./repertoire.fixtures";

function render(overrides: Partial<LineNavigatorProps> = {}) {
  return renderToStaticMarkup(
    <LineNavigator
      path={[e4Move]}
      childMoves={[e5Move, c5Move]}
      onSelectPly={() => {}}
      onSelectChild={() => {}}
      onDelete={() => {}}
      {...overrides}
    />,
  );
}

describe("LineNavigator", () => {
  test("shows breadcrumbs back to the start, marking the current position", () => {
    const html = render({ path: [e4Move, e5Move], childMoves: [] });
    expect(html).toContain('aria-label="Path to this position"');
    expect(html).toContain(">Start</button>");
    expect(html).toContain("1. e4");
    expect(html.match(/aria-current="location"/g)).toHaveLength(1);
  });

  test("marks the start as current when no move was played", () => {
    const html = render({ path: [], childMoves: [e4Move] });
    expect(html).toMatch(/aria-current="location"[^>]*>Start</);
  });

  test("lists each continuation, telling your moves from opponent replies", () => {
    const html = render();
    expect(html).toContain("1... e5");
    expect(html).toContain("1... c5");
    expect(html).toContain("Opponent reply");
    const atStart = render({ path: [], childMoves: [e4Move] });
    expect(atStart).toContain("Your move");
  });

  test("names each delete button after the move it removes, and offers to delete this move", () => {
    const html = render();
    expect(html).toContain('aria-label="Delete 1... e5 and its continuations"');
    expect(html).toContain("Delete this move");
  });

  test("explains an empty list of continuations and has no delete-this-move at the start", () => {
    const html = render({ path: [], childMoves: [] });
    expect(html).toContain("No moves from here yet");
    expect(html).not.toContain("Delete this move");
  });
});
