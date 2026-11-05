import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { GUIDE_SECTIONS, TRAINING_PLAN } from "../lib/guide-content";
import BlindfoldGuide from "./blindfold-guide";

describe("BlindfoldGuide", () => {
  test("renders every section as an open card with its takeaway, in reading order", async () => {
    const html = await renderWithRouter(
      <BlindfoldGuide sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} />,
    );
    expect(GUIDE_SECTIONS.map((section) => section.title)).toEqual([
      "Square colours",
      "Diagonals to memorise",
      "Knight geometry",
      "Landmarks and anchors",
      "Reading piece lists",
      "Checks and lines",
      "Following moves",
      "Mating patterns to visualise",
      "Techniques",
    ]);
    for (const section of GUIDE_SECTIONS) {
      expect(html).toContain(section.title);
      expect(html).toContain(`id="guide-${section.id}"`);
      expect(html).toContain(`href="#guide-${section.id}"`);
    }
    expect(html).toContain('aria-label="Guide contents"');
    expect(html).toContain("Kings first, then pawns, then pieces.");
    // Squares are set in mono inside the prose.
    expect(html).toContain('font-mono text-[0.92em] text-foreground">a1</span> is dark');
  });

  test("draws a labelled board for every section with a diagram", async () => {
    const html = await renderWithRouter(
      <BlindfoldGuide sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} />,
    );
    const withDiagram = GUIDE_SECTIONS.filter((section) => section.diagram);
    expect(html.match(/role="img"/g)).toHaveLength(withDiagram.length);
    expect(html).toContain('aria-label="The long diagonals: a1-h8 runs on dark squares');
  });

  test("lists the six-week plan as a timeline with minutes, goals and drills", async () => {
    const html = await renderWithRouter(
      <BlindfoldGuide sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} />,
    );
    expect(html).toContain("Six-week training plan");
    for (const week of TRAINING_PLAN) {
      expect(html).toContain(`Week ${week.week}`);
      expect(html).toContain(week.goal);
    }
    expect(html).toContain("Knight distance");
    expect(html).toContain("Away from the drills");
  });

  test("renders drill chips as buttons only when onPractise is given", async () => {
    const plain = await renderWithRouter(
      <BlindfoldGuide sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} />,
    );
    expect(plain).not.toContain("<button");
    expect(plain).toContain("Practise with");

    const linked = await renderWithRouter(
      <BlindfoldGuide sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} onPractise={() => {}} />,
    );
    expect(linked).toContain('aria-label="Practise Shared diagonal"');
  });
});
