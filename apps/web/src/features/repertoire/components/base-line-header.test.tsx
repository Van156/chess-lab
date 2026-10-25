import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import BaseLineHeader, { type BaseLineHeaderProps } from "./base-line-header";
import { e4Move, e5Move } from "./repertoire.fixtures";

function render(overrides: Partial<BaseLineHeaderProps> = {}) {
  return renderToStaticMarkup(
    <BaseLineHeader
      baseLine={[]}
      startPositionId="p0"
      basePositionId={null}
      currentPositionId="p1"
      saving={false}
      onSelect={() => {}}
      onSetBase={() => {}}
      onClearBase={() => {}}
      {...overrides}
    />,
  );
}

const withBase = { baseLine: [e4Move, e5Move], basePositionId: "p2" };

describe("BaseLineHeader", () => {
  test("reads Start position without a base, marked as current at the start", () => {
    expect(render()).toContain(">Start position</button>");
    expect(render({ currentPositionId: "p0" })).toMatch(
      /aria-current="location"[^>]*>Start position</,
    );
  });

  test("reads the base in move-pair notation, marked as current at the base", () => {
    expect(render(withBase)).toContain(">Base: 1. e4 e5</button>");
    expect(render({ ...withBase, currentPositionId: "p2" })).toMatch(
      /aria-current="location"[^>]*>Base: 1\. e4 e5</,
    );
    expect(render(withBase)).not.toContain('aria-current="location"');
  });

  test("wraps a long base instead of scrolling", () => {
    expect(render(withBase)).toMatch(/<button[^>]*class="[^"]*\bbreak-words\b[^>]*>Base:/);
  });

  test("offers Set as base away from the start and the base, as a 44px button", () => {
    const html = render();
    expect(html).toContain('aria-label="Set this position as the base line"');
    expect(html).toMatch(/<button[^>]*class="[^"]*\bmin-h-11\b[^>]*>Set as base</);
    expect(render({ currentPositionId: "p0" })).not.toContain("Set as base");
    expect(render({ ...withBase, currentPositionId: "p2" })).not.toContain("Set as base");
  });

  test("offers Clear base only when a base is set", () => {
    expect(render()).not.toContain("Clear base");
    const html = render(withBase);
    expect(html).toContain('aria-label="Clear the base line"');
    expect(html).toMatch(/<button[^>]*class="[^"]*\bmin-h-11\b[^>]*>Clear base</);
  });

  test("disables both actions while a base change is saving", () => {
    const html = render({ ...withBase, saving: true });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Set this position/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Clear the base line"/);
  });
});
