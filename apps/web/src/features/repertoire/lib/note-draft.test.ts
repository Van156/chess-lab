import { describe, expect, test } from "bun:test";

import { draftAfterDelete, draftAfterSave } from "./note-draft";
import type { RepertoireGraph } from "./repertoire-tree";
import type { IdeaNote } from "./repertoire-types";

/** start -e4-> p1 -e5-> p2 ; start -d4-> p3 */
const graph = {
  startPositionId: "start",
  moves: [
    { id: "m1", fromPositionId: "start", toPositionId: "p1" },
    { id: "m2", fromPositionId: "p1", toPositionId: "p2" },
    { id: "m3", fromPositionId: "start", toPositionId: "p3" },
  ],
} as RepertoireGraph;

const plan = (text: string): IdeaNote => ({ arrows: [], highlights: [], plan: text });

describe("draftAfterSave", () => {
  test("clears the draft that was just saved", () => {
    const draft = { positionId: "p1", note: plan("King's Gambit") };
    expect(draftAfterSave(draft, "p1", plan("King's Gambit"))).toBeNull();
  });

  test("compares the trimmed plan, since the save trims it", () => {
    const draft = { positionId: "p1", note: plan("  Castle early ") };
    expect(draftAfterSave(draft, "p1", plan("  Castle early "))).toBeNull();
  });

  test("keeps what was typed while the save was in flight", () => {
    const draft = { positionId: "p1", note: plan("Castle early, then") };
    expect(draftAfterSave(draft, "p1", plan("Castle early"))).toBe(draft);
  });

  test("keeps the draft of another position", () => {
    const draft = { positionId: "p2", note: plan("Other idea") };
    expect(draftAfterSave(draft, "p1", plan("Castle early"))).toBe(draft);
  });

  test("clearing discards the draft that was shown when it was requested", () => {
    const draft = { positionId: "p1", note: plan("Scrap this") };
    expect(draftAfterSave(draft, "p1", plan("Scrap this"))).toBeNull();
  });

  test("has nothing to clear without a draft", () => {
    expect(draftAfterSave(null, "p1", plan("x"))).toBeNull();
  });
});

describe("draftAfterDelete", () => {
  test("keeps a draft whose position survives the prune", () => {
    const draft = { positionId: "p3", note: plan("Keep me") };
    expect(draftAfterDelete(draft, graph, "m1")).toBe(draft);
  });

  test("drops a draft whose position is pruned", () => {
    const draft = { positionId: "p2", note: plan("Gone") };
    expect(draftAfterDelete(draft, graph, "m1")).toBeNull();
  });

  test("keeps a draft on the position the deleted move was played from", () => {
    const draft = { positionId: "start", note: plan("Root idea") };
    expect(draftAfterDelete(draft, graph, "m1")).toBe(draft);
  });

  test("has nothing to drop without a draft", () => {
    expect(draftAfterDelete(null, graph, "m1")).toBeNull();
  });
});
