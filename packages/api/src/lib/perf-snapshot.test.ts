import { describe, expect, test } from "bun:test";

import { parsePerfSnapshot } from "./perf-snapshot";

describe("parsePerfSnapshot", () => {
  test("keeps well-formed perf entries", () => {
    const raw = { rapid: { rating: 1650, games: 40, prov: false }, blitz: { rating: 1500 } };
    expect(parsePerfSnapshot(raw)).toEqual(raw);
  });

  test("drops unknown fields of an entry", () => {
    expect(parsePerfSnapshot({ rapid: { rating: 1650, games: 3, prog: 12 } })).toEqual({
      rapid: { rating: 1650, games: 3 },
    });
  });

  test.each([[null], [undefined], ["rapid"], [42], [[]], [[{ rating: 1 }]]])(
    "treats %p as unknown",
    (raw) => {
      expect(parsePerfSnapshot(raw)).toBeNull();
    },
  );

  test.each([
    [{ rapid: { rating: "1650" } }],
    [{ rapid: { rating: 1650, games: "many" } }],
    [{ rapid: { rating: 1650, prov: "yes" } }],
    [{ rapid: 1650 }],
    [{ rapid: null }],
    [{ rapid: { rating: Number.NaN } }],
  ])("treats a malformed entry %p as unknown", (raw) => {
    expect(parsePerfSnapshot(raw)).toBeNull();
  });
});
