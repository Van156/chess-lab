import { describe, expect, test } from "bun:test";

import { IDEA_NOTE_PLAN_MAX_LENGTH } from "@b2c-template/api/lib/repertoire-limits";

import {
  describeNote,
  isEmptyNote,
  notesEqual,
  removeSquare,
  toggleArrow,
  validatePlan,
} from "./idea-note";

describe("validatePlan", () => {
  test("accepts an empty plan and one up to 140 characters", () => {
    expect(validatePlan("")).toBeNull();
    expect(validatePlan("   ")).toBeNull();
    expect(validatePlan("x".repeat(IDEA_NOTE_PLAN_MAX_LENGTH))).toBeNull();
  });

  test("counts the trimmed text, like the server", () => {
    expect(validatePlan(` ${"x".repeat(IDEA_NOTE_PLAN_MAX_LENGTH)} `)).toBeNull();
  });

  test("rejects a plan over 140 characters", () => {
    expect(validatePlan("x".repeat(IDEA_NOTE_PLAN_MAX_LENGTH + 1))).toBe(
      "The plan must be 140 characters or fewer.",
    );
  });

  test("rejects more than one line", () => {
    expect(validatePlan("first\nsecond")).toBe("The plan must be one line.");
    expect(validatePlan("first\r\nsecond")).toBe("The plan must be one line.");
  });
});

describe("describeNote", () => {
  test("says there is no note for an empty one", () => {
    expect(describeNote({ arrows: [], highlights: [], plan: "" })).toBe("No idea note.");
  });

  test("describes one arrow and one highlight", () => {
    expect(describeNote({ arrows: [{ from: "e2", to: "e4" }], highlights: ["d5"], plan: "" })).toBe(
      "Arrow e2 to e4. Highlighted: d5.",
    );
  });

  test("lists several arrows and highlights and ends with the plan", () => {
    expect(
      describeNote({
        arrows: [
          { from: "e2", to: "e4" },
          { from: "g1", to: "f3" },
        ],
        highlights: ["d5", "e5"],
        plan: "Fight for the centre",
      }),
    ).toBe("Arrows: e2 to e4, g1 to f3. Highlighted: d5, e5. Plan: Fight for the centre");
  });

  test("describes a plan on its own", () => {
    expect(describeNote({ arrows: [], highlights: [], plan: "Castle early" })).toBe(
      "Plan: Castle early",
    );
  });
});

describe("removeSquare", () => {
  test("removes a present square and ignores a missing one", () => {
    expect(removeSquare(["d5", "e5"], "d5")).toEqual(["e5"]);
    expect(removeSquare(["d5"], "e5")).toEqual(["d5"]);
  });
});

describe("toggleArrow", () => {
  test("adds a new arrow and removes the same one", () => {
    const arrow = { from: "e2", to: "e4" };
    expect(toggleArrow([], arrow)).toEqual([arrow]);
    expect(toggleArrow([arrow], { ...arrow })).toEqual([]);
  });

  test("ignores an arrow from a square to itself", () => {
    expect(toggleArrow([], { from: "e2", to: "e2" })).toEqual([]);
  });
});

describe("isEmptyNote", () => {
  test("is empty without arrows, highlights and a plan", () => {
    expect(isEmptyNote({ arrows: [], highlights: [], plan: "  " })).toBe(true);
    expect(isEmptyNote({ arrows: [], highlights: ["d5"], plan: "" })).toBe(false);
    expect(isEmptyNote({ arrows: [], highlights: [], plan: "x" })).toBe(false);
  });
});

describe("notesEqual", () => {
  const note = { arrows: [{ from: "g1", to: "f3" }], highlights: ["e4"], plan: "Develop" };

  test("treats the same content as equal, ignoring spaces around the plan", () => {
    expect(notesEqual(note, { ...note, plan: " Develop " })).toBe(true);
  });

  test("sees a changed arrow, highlight or plan", () => {
    expect(notesEqual(note, { ...note, arrows: [] })).toBe(false);
    expect(notesEqual(note, { ...note, highlights: ["e5"] })).toBe(false);
    expect(notesEqual(note, { ...note, plan: "Castle" })).toBe(false);
  });
});
