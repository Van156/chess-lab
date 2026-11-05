import { describe, expect, test } from "bun:test";

import { formatUtcDate, sideLabel } from "./game-display";

describe("formatUtcDate", () => {
  test("is the UTC calendar date, whatever the viewer's zone", () => {
    expect(formatUtcDate(new Date("2026-10-04T23:59:59Z"))).toBe("2026-10-04");
    expect(formatUtcDate(new Date("2026-10-05T00:00:00Z"))).toBe("2026-10-05");
  });
});

describe("sideLabel", () => {
  test("names the side", () => {
    expect(sideLabel("white")).toBe("White");
    expect(sideLabel("black")).toBe("Black");
  });
});
