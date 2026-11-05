import { describe, expect, test } from "bun:test";

import { DRILL_CATALOG } from "./drill-catalog";
import { GUIDE_SECTIONS, TRAINING_PLAN } from "./guide-content";
import { parseSquare } from "./squares";

const catalogKinds = new Set(DRILL_CATALOG.map((drill) => drill.kind));

describe("GUIDE_SECTIONS", () => {
  test("ids are unique and every section has a summary, a takeaway and bullets", () => {
    const ids = GUIDE_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of GUIDE_SECTIONS) {
      expect(section.summary.length).toBeGreaterThan(0);
      expect(section.takeaway.length).toBeGreaterThan(0);
      expect(section.bullets.length).toBeGreaterThan(0);
      expect(new Set(section.bullets).size).toBe(section.bullets.length);
    }
  });

  test("every linked drill exists in the catalog", () => {
    for (const section of GUIDE_SECTIONS) {
      for (const kind of section.drills) expect(catalogKinds.has(kind)).toBe(true);
    }
  });

  test("every drill is linked from at least one section", () => {
    const linked = new Set(GUIDE_SECTIONS.flatMap((section) => section.drills));
    expect([...catalogKinds].filter((kind) => !linked.has(kind))).toEqual([]);
  });

  test("diagrams use valid squares and pieces, one piece per square", () => {
    for (const section of GUIDE_SECTIONS) {
      const diagram = section.diagram;
      if (!diagram) continue;
      expect(diagram.caption.length).toBeGreaterThan(0);
      const squares = [
        ...(diagram.highlights ?? []),
        ...(diagram.arrows ?? []).flatMap((arrow) => [arrow.from, arrow.to]),
        ...(diagram.pieces ?? []).map((piece) => piece.square),
      ];
      for (const square of squares) expect(parseSquare(square)).not.toBeNull();
      for (const { piece } of diagram.pieces ?? []) expect(piece).toMatch(/^[KQRBNPkqrbnp]$/);
      const occupied = (diagram.pieces ?? []).map((piece) => piece.square);
      expect(new Set(occupied).size).toBe(occupied.length);
      for (const arrow of diagram.arrows ?? []) expect(arrow.from).not.toBe(arrow.to);
    }
  });

  test("the knight diagram highlights exactly the knight's squares", () => {
    const diagram = GUIDE_SECTIONS.find((section) => section.id === "knight-geometry")?.diagram;
    const knight = diagram?.pieces?.[0];
    expect(knight?.piece).toBe("N");
    const from = parseSquare(knight?.square ?? "");
    const reach = (diagram?.highlights ?? []).map((square) => {
      const to = parseSquare(square);
      return to && from
        ? [Math.abs(to.file - from.file), Math.abs(to.rank - from.rank)].sort()
        : [];
    });
    for (const delta of reach) expect(delta).toEqual([1, 2]);
    expect(reach).toHaveLength(8);
  });
});

describe("TRAINING_PLAN", () => {
  test("runs six consecutive weeks with minutes and a goal", () => {
    expect(TRAINING_PLAN.map((week) => week.week)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const week of TRAINING_PLAN) {
      expect(Number.isInteger(week.minutes) && week.minutes > 0).toBe(true);
      expect(week.goal.length).toBeGreaterThan(0);
    }
  });

  test("covers all eight drills, each one from the catalog", () => {
    const planned = TRAINING_PLAN.flatMap((week) => week.drills);
    for (const kind of planned) expect(catalogKinds.has(kind)).toBe(true);
    expect(new Set(planned)).toEqual(catalogKinds);
    expect(catalogKinds.size).toBe(8);
  });

  test("introduces drills in catalog order", () => {
    const planned = TRAINING_PLAN.flatMap((week) => week.drills);
    expect(planned).toEqual(DRILL_CATALOG.map((drill) => drill.kind));
  });
});
