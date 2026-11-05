import { describe, expect, test } from "bun:test";

import { DRILL_CATALOG } from "./drill-catalog";
import { describeLastPlayed, suggestDrill } from "./suggest-drill";

const [first, second, third] = DRILL_CATALOG;

describe("suggestDrill", () => {
  test("suggests the first drill when nothing was played", () => {
    expect(suggestDrill(DRILL_CATALOG)?.kind).toBe(first!.kind);
    expect(suggestDrill(DRILL_CATALOG, [{ drill: first!.kind, lastPlayedAt: null }])?.kind).toBe(
      first!.kind,
    );
  });

  test("suggests a drill never played before one played already", () => {
    const recency = [{ drill: first!.kind, lastPlayedAt: "2026-11-01T10:00:00Z" }];
    expect(suggestDrill(DRILL_CATALOG, recency)?.kind).toBe(second!.kind);
  });

  test("suggests the drill played least recently once all were played", () => {
    const drills = [first!, second!, third!];
    const recency = [
      { drill: first!.kind, lastPlayedAt: new Date("2026-11-04T10:00:00Z") },
      { drill: second!.kind, lastPlayedAt: "2026-10-20T10:00:00Z" },
      { drill: third!.kind, lastPlayedAt: "2026-11-02T10:00:00Z" },
    ];
    expect(suggestDrill(drills, recency)?.kind).toBe(second!.kind);
  });

  test("returns null without drills", () => {
    expect(suggestDrill([])).toBeNull();
  });
});

describe("describeLastPlayed", () => {
  test("words the gap in days", () => {
    expect(describeLastPlayed(null, "2026-11-05")).toBe("New to you");
    expect(describeLastPlayed("2026-11-05T09:00:00Z", "2026-11-05")).toBe("Last played today");
    expect(describeLastPlayed("2026-11-04T09:00:00Z", "2026-11-05")).toBe("Last played yesterday");
    expect(describeLastPlayed("2026-10-30T09:00:00Z", "2026-11-05")).toBe("Last played 6 days ago");
  });
});
