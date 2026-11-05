import { describe, expect, test } from "bun:test";

import {
  MAX_UNDO_ENTRIES,
  findEntry,
  newestEntry,
  pushEntry,
  removeEntry,
  restoreTarget,
} from "./deletion-undo";
import type { RepertoireGraph } from "./repertoire-tree";
import type { RepertoireMove } from "./repertoire-types";

const entry = (id: string) => ({ id });

describe("undo stack", () => {
  test("pushes entries newest last and reads the newest", () => {
    const stack = pushEntry(pushEntry([], entry("a")), entry("b"));
    expect(stack.map((item) => item.id)).toEqual(["a", "b"]);
    expect(newestEntry(stack)).toEqual({ id: "b" });
    expect(newestEntry([])).toBeUndefined();
  });

  test("does not mutate the stack it is given", () => {
    const stack = [entry("a")];
    pushEntry(stack, entry("b"));
    removeEntry(stack, "a");
    expect(stack).toEqual([entry("a")]);
  });

  test("keeps only the newest entries once the cap is exceeded", () => {
    let stack: { id: string }[] = [];
    for (let index = 0; index < MAX_UNDO_ENTRIES + 3; index++) {
      stack = pushEntry(stack, entry(`e${index}`));
    }
    expect(stack).toHaveLength(MAX_UNDO_ENTRIES);
    expect(stack[0]?.id).toBe("e3");
    expect(newestEntry(stack)?.id).toBe(`e${MAX_UNDO_ENTRIES + 2}`);
  });

  test("removes an entry from anywhere and keeps the others in order", () => {
    const stack = [entry("a"), entry("b"), entry("c")];
    expect(removeEntry(stack, "b").map((item) => item.id)).toEqual(["a", "c"]);
    expect(removeEntry(stack, "a").map((item) => item.id)).toEqual(["b", "c"]);
    expect(removeEntry(stack, "zzz")).toEqual(stack);
  });

  test("finds an entry by id", () => {
    const stack = [entry("a"), entry("b")];
    expect(findEntry(stack, "a")).toEqual({ id: "a" });
    expect(findEntry(stack, "nope")).toBeUndefined();
  });
});

describe("restoreTarget", () => {
  const move = (id: string, from: string, to: string): RepertoireMove => ({
    id,
    fromPositionId: from,
    toPositionId: to,
    san: id,
    uci: id,
    name: null,
    isUserMove: true,
  });
  // start -a-> p1 -b-> p2 -c-> p3 ; start -d-> p4 -e-> p1 (transposition into p1)
  const moves = [
    move("a", "start", "p1"),
    move("b", "p1", "p2"),
    move("c", "p2", "p3"),
    move("d", "start", "p4"),
    move("e", "p4", "p1"),
  ];
  const graph: RepertoireGraph = { startPositionId: "start", moves };
  const byId = (...ids: string[]) =>
    ids.map((id) => moves.find((candidate) => candidate.id === id) as RepertoireMove);

  test("goes to the deleted move's target along the line being shown", () => {
    expect(restoreTarget(graph, byId("b")[0] as RepertoireMove, byId("a", "b", "c"))).toEqual({
      positionId: "p2",
      route: ["a", "b"],
    });
  });

  test("keeps the transposition route that led to the move", () => {
    expect(restoreTarget(graph, byId("b")[0] as RepertoireMove, byId("d", "e", "b"))).toEqual({
      positionId: "p2",
      route: ["d", "e", "b"],
    });
  });

  test("falls back to the shortest route when the move was not on the shown line", () => {
    expect(restoreTarget(graph, byId("c")[0] as RepertoireMove, byId("d"))).toEqual({
      positionId: "p3",
      route: ["a", "b", "c"],
    });
  });
});
