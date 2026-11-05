import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import MoveList from "./move-list";

describe("MoveList", () => {
  test("renders an ordered list of full moves in SAN", () => {
    const html = renderToStaticMarkup(<MoveList moves={["e4", "e5", "Nf3"]} currentPly={3} />);
    expect(html).toContain("<ol");
    expect(html).toContain("1.");
    expect(html).toContain("e4");
    expect(html).toContain("e5");
    expect(html).toContain("2.");
    expect(html).toContain("Nf3");
    expect(html.match(/<li/g)).toHaveLength(2);
  });

  test("marks only the current ply with aria-current", () => {
    const html = renderToStaticMarkup(<MoveList moves={["e4", "e5", "Nf3"]} currentPly={2} />);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="step"[^>]*>e5</);
  });

  test("marks nothing as current at the starting position", () => {
    const html = renderToStaticMarkup(<MoveList moves={["e4", "e5"]} currentPly={0} />);
    expect(html).not.toContain("aria-current");
  });

  test("renders selectable buttons of at least 44 px when onSelect is given", () => {
    const html = renderToStaticMarkup(
      <MoveList moves={["e4", "e5"]} currentPly={1} onSelect={() => {}} />,
    );
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain("min-h-11");
    expect(html).toContain('type="button"');
  });

  test("renders plain text, no buttons, without onSelect", () => {
    const html = renderToStaticMarkup(<MoveList moves={["e4", "e5"]} currentPly={1} />);
    expect(html).not.toContain("<button");
  });

  test("announces the current move politely in text", () => {
    const html = renderToStaticMarkup(<MoveList moves={["e4", "e5"]} currentPly={2} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Current move: 1... e5");
  });

  test("renders an empty-state note for no moves", () => {
    const html = renderToStaticMarkup(<MoveList moves={[]} currentPly={0} />);
    expect(html).toContain("No moves yet");
    expect(html).not.toContain("<li");
  });
});

describe("MoveList out-of-range currentPly", () => {
  test("clamps a ply past the end to the last move", () => {
    const html = renderToStaticMarkup(<MoveList moves={["e4", "e5"]} currentPly={9} />);
    expect(html).toContain("Current move: 1... e5");
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });

  test("clamps a negative or non-numeric ply to the starting position", () => {
    for (const ply of [-3, Number.NaN]) {
      const html = renderToStaticMarkup(<MoveList moves={["e4", "e5"]} currentPly={ply} />);
      expect(html).toContain("Starting position");
      expect(html).not.toContain("aria-current");
    }
  });
});
