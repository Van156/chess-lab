import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { DRILL_CATALOG, DRILL_CATEGORIES } from "../lib/drill-catalog";
import { DRILL_KINDS } from "../lib/questions";
import DrillProgress from "./drill-progress";
import { EMPTY_STATS, PLAYED_STATS, PROGRESS_NOW } from "./drill-progress.fixtures";

const render = (stats = PLAYED_STATS) =>
  renderWithRouter(<DrillProgress drills={DRILL_CATALOG} stats={stats} now={PROGRESS_NOW} />);

describe("DrillProgress", () => {
  test("fixtures cover every drill", () => {
    expect(PLAYED_STATS.map((stat) => stat.drill).toSorted()).toEqual([...DRILL_KINDS].toSorted());
  });

  test("lists every drill under its category heading", async () => {
    const html = await render();
    for (const category of DRILL_CATEGORIES) {
      expect(html).toContain(`>${category.label}</h3>`);
    }
    for (const drill of DRILL_CATALOG) {
      expect(html).toContain(drill.label);
    }
    // Catalogue order within a category, categories in order.
    expect(html.indexOf("Board geometry")).toBeLessThan(html.indexOf("Piece vision"));
    expect(html.indexOf("Shared diagonal")).toBeLessThan(html.indexOf("Knight distance"));
  });

  test("shows sessions, best accuracy and when each drill was last played", async () => {
    const html = await render();
    expect(html).toContain(">12<");
    expect(html).toContain(">100%<");
    expect(html).toContain(">80%<");
    expect(html).toContain(">55%<");
    expect(html).toContain(">Today<");
    expect(html).toContain(">2 days ago<");
    expect(html).toContain(">1 week ago<");
    expect(html).toContain(">1 month ago<");
    expect(html).toContain("26 sessions · 6 of 8 drills started");
  });

  test("summarises each trend for screen readers, oldest first", async () => {
    const html = await render();
    expect(html).toContain(
      "Square colour recent accuracy. Last 4 sessions, oldest first: 60%, 75%, 85%, 95%; up 35 points.",
    );
    expect(html).toContain("Knight distance recent accuracy. Last session: 55%.");
    expect(html).toContain("<svg");
  });

  test("marks drills never played as not started, with no trend", async () => {
    const html = await render();
    expect(html.match(/>Not started</g)).toHaveLength(2);
    expect(html).not.toContain("Diagonals recent accuracy");
  });

  test("shows a dash when the last played date is unknown", async () => {
    const html = await render(PLAYED_STATS.map((stat) => ({ ...stat, lastPlayedAt: null })));
    expect(html).not.toContain(">Today<");
    expect(html).toContain(">–<");
  });

  test("explains the empty state before any session is saved", async () => {
    const html = await render(EMPTY_STATS);
    expect(html).toContain("No sessions yet");
    expect(html).not.toContain("Best accuracy");
    expect(html).not.toContain("Not started");
  });
});
