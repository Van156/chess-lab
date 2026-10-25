import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import { GUIDE_SECTIONS, TRAINING_PLAN } from "../lib/guide-content";
import BlindfoldGuide from "./blindfold-guide";
import BlindfoldView from "./blindfold-view";

describe("BlindfoldGuide", () => {
  test("renders a heading for every guide section", async () => {
    const html = await renderWithRouter(
      <BlindfoldGuide sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} />,
    );
    for (const section of GUIDE_SECTIONS) {
      expect(html).toContain(section.title);
    }
    expect(GUIDE_SECTIONS.map((section) => section.title)).toEqual([
      "Square colours",
      "Diagonals to memorise",
      "Knight geometry",
      "Landmarks and anchors",
      "Mating patterns to visualise",
      "Techniques",
    ]);
  });

  test("opens the first section and lists the four-week plan with its drills", async () => {
    const html = await renderWithRouter(
      <BlindfoldGuide sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} />,
    );
    expect(html).toContain("a1 is dark and h1 is light");
    expect(html).toContain("Four-week training plan");
    for (const week of [1, 2, 3, 4]) {
      expect(html).toContain(`Week ${week}`);
    }
    expect(html).toContain("Knight distance");
  });
});

describe("BlindfoldView", () => {
  test("offers the Guide and Drills tabs and a header", async () => {
    const html = await renderWithRouter(
      <BlindfoldView sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} drills={DRILL_CATALOG} />,
    );
    expect(html).toContain("Blindfold");
    expect(html).toContain(">Guide<");
    expect(html).toContain(">Drills<");
  });
});
