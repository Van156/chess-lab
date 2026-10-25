import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import DrillProgress from "./drill-progress";
import { EMPTY_STATS, PLAYED_STATS } from "./drill-progress.fixtures";

describe("DrillProgress", () => {
  test("shows sessions, best accuracy and the recent trend for each drill", async () => {
    const html = await renderWithRouter(
      <DrillProgress drills={DRILL_CATALOG} stats={PLAYED_STATS} />,
    );
    for (const drill of DRILL_CATALOG) {
      expect(html).toContain(drill.label);
    }
    expect(html).toContain(">12<");
    expect(html).toContain(">100%<");
    expect(html).toContain(">80%<");
    expect(html).toContain(">55%<");
    expect(html).toContain('aria-label="Square colour recent accuracy"');
    // Oldest first: 60%, 75%, 85%, 95%.
    expect(html.indexOf(">60%<")).toBeLessThan(html.indexOf(">95%<"));
    // A drill with no sessions has no best accuracy and no trend.
    expect(html).toContain(">–<");
    expect(html).not.toContain('aria-label="Diagonals recent accuracy"');
  });

  test("explains the empty state before any session is saved", async () => {
    const html = await renderWithRouter(
      <DrillProgress drills={DRILL_CATALOG} stats={EMPTY_STATS} />,
    );
    expect(html).toContain("No sessions yet");
    expect(html).not.toContain("Best accuracy");
  });
});
