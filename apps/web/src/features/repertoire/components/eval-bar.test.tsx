import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import EvalBar, { type EvalBarProps } from "./eval-bar";

const render = (props: Partial<EvalBarProps> = {}) =>
  renderToStaticMarkup(<EvalBar whitePercent={68} orientation="white" {...props} />);

describe("EvalBar", () => {
  test("is decorative", () => {
    expect(render()).toContain('aria-hidden="true"');
  });

  test("draws White's share from the bottom for white and from the top for black", () => {
    expect(render()).toMatch(/bottom-0[^>]*style="height:68%"/);
    expect(render({ orientation: "black" })).toMatch(/top-0[^>]*style="height:68%"/);
  });

  test("is neutral without a score", () => {
    expect(render({ whitePercent: null })).toContain("height:50%");
  });

  test("keeps the share inside the bar", () => {
    expect(render({ whitePercent: 140 })).toContain("height:100%");
    expect(render({ whitePercent: -5 })).toContain("height:0%");
  });

  test("falls back to neutral for a non-finite score", () => {
    expect(render({ whitePercent: Number.NaN })).toContain("height:50%");
    expect(render({ whitePercent: Number.POSITIVE_INFINITY })).toContain("height:50%");
    expect(render({ whitePercent: Number.NEGATIVE_INFINITY })).toContain("height:50%");
  });
});
