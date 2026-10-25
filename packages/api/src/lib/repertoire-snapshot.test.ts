import { START_FEN, parseMove, positionKey } from "@b2c-template/chess";
import { describe, expect, test } from "bun:test";

import { buildDeletionSnapshot, planRestore } from "./repertoire-snapshot";
import type { DeletionSnapshot } from "./repertoire-snapshot";

const T = "2026-01-01T00:00:00.000Z";

/** Chains the SAN moves from the start, returning positions and moves with ids `p0..`, `m1..`. */
function chain(sans: string[]) {
  const positions = [{ id: "p0", fen: START_FEN }];
  const moves: {
    id: string;
    fromPositionId: string;
    toPositionId: string;
    san: string;
    uci: string;
  }[] = [];
  for (const [i, san] of sans.entries()) {
    const parsed = parseMove(positions[i]!.fen, san)!;
    positions.push({ id: `p${i + 1}`, fen: parsed.fenAfter });
    moves.push({
      id: `m${i + 1}`,
      fromPositionId: `p${i}`,
      toPositionId: `p${i + 1}`,
      san: parsed.san,
      uci: parsed.uci,
    });
  }
  return {
    positions: positions.map((p) => ({
      id: p.id,
      positionKey: positionKey(p.fen),
      fen: p.fen,
      sideToMove: p.fen.split(" ")[1] as "w" | "b",
      createdAt: T,
      updatedAt: T,
    })),
    moves: moves.map((m) => ({ ...m, name: null as string | null, createdAt: T, updatedAt: T })),
  };
}

const snapshotOf = (sans: string[]): DeletionSnapshot => {
  const { positions, moves } = chain(sans);
  return {
    version: 1,
    repertoireId: "r1",
    deletedMoveId: "m1",
    positions: positions.slice(1),
    moves,
    ideaNotes: [
      {
        repertoirePositionId: "p2",
        arrows: [{ from: "e7", to: "e5" }],
        highlights: ["e5"],
        plan: "Fight for the centre",
        createdAt: T,
        updatedAt: T,
      },
    ],
    basePositionId: "p3",
  };
};

const current = (over: Partial<Parameters<typeof planRestore>[1]> = {}) => ({
  positions: [{ id: "p0", positionKey: positionKey(START_FEN), fen: START_FEN }],
  moves: [] as { id: string; fromPositionId: string; uci: string }[],
  notedPositionIds: new Set<string>(),
  currentBasePositionId: null as string | null,
  ...over,
});

describe("buildDeletionSnapshot", () => {
  test("keeps exactly the removed rows and the base only when it was among them", () => {
    const { positions, moves } = chain(["e4", "e5", "Nf3"]);
    const note = snapshotOf(["e4", "e5", "Nf3"]).ideaNotes;
    const args = {
      repertoireId: "r1",
      deletedMoveId: "m1",
      positions,
      moves,
      ideaNotes: note,
    };
    const removed = new Set(["p1", "p2", "p3"]);
    const withBase = buildDeletionSnapshot({
      ...args,
      removedPositionIds: removed,
      basePositionId: "p3",
    });
    expect(withBase.version).toBe(1);
    expect(withBase.positions.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(withBase.moves.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(withBase.basePositionId).toBe("p3");
    const kept = buildDeletionSnapshot({
      ...args,
      removedPositionIds: removed,
      basePositionId: "p0",
    });
    expect(kept.basePositionId).toBeNull();
  });
});

describe("planRestore", () => {
  test("plans every row with its original id", () => {
    const snap = snapshotOf(["e4", "e5", "Nf3"]);
    const plan = planRestore(snap, current());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.positions.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(plan.moves.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(plan.ideaNotes.map((n) => n.repertoirePositionId)).toEqual(["p2"]);
    expect(plan.basePositionId).toBe("p3");
  });

  test("does not restore the base when one is already set", () => {
    const plan = planRestore(
      snapshotOf(["e4", "e5", "Nf3"]),
      current({ currentBasePositionId: "x" }),
    );
    expect(plan.ok && plan.basePositionId).toBeNull();
  });

  test("parent missing and edge already exists are conflicts", () => {
    const snap = snapshotOf(["e4", "e5"]);
    expect(planRestore(snap, current({ positions: [] }))).toEqual({
      ok: false,
      reason: "parent_missing",
    });
    const taken = current({ moves: [{ id: "other", fromPositionId: "p0", uci: "e2e4" }] });
    expect(planRestore(snap, taken)).toEqual({ ok: false, reason: "edge_exists" });
  });

  test("a move id that already exists is a conflict", () => {
    const taken = current({ moves: [{ id: "m1", fromPositionId: "zz", uci: "a2a3" }] });
    expect(planRestore(snapshotOf(["e4", "e5", "Nf3"]), taken)).toEqual({
      ok: false,
      reason: "move_exists",
    });
  });

  test("reuses a re-added position by key and remaps its moves, notes and base", () => {
    const snap = snapshotOf(["e4", "e5", "Nf3"]);
    const p2 = snap.positions.find((p) => p.id === "p2")!;
    const plan = planRestore(
      snap,
      current({
        positions: [
          { id: "p0", positionKey: positionKey(START_FEN), fen: START_FEN },
          { id: "new2", positionKey: p2.positionKey, fen: p2.fen },
        ],
      }),
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.positions.map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(plan.moves.map((m) => [m.id, m.fromPositionId, m.toPositionId])).toEqual([
      ["m1", "p0", "p1"],
      ["m2", "p1", "new2"],
      ["m3", "new2", "p3"],
    ]);
    expect(plan.ideaNotes.map((n) => n.repertoirePositionId)).toEqual(["new2"]);
  });

  test("a reused position keeps its own note", () => {
    const snap = snapshotOf(["e4", "e5"]);
    const p2 = snap.positions.find((p) => p.id === "p2")!;
    const plan = planRestore(
      snap,
      current({
        positions: [
          { id: "p0", positionKey: positionKey(START_FEN), fen: START_FEN },
          { id: "new2", positionKey: p2.positionKey, fen: p2.fen },
        ],
        notedPositionIds: new Set(["new2"]),
      }),
    );
    expect(plan.ok && plan.ideaNotes).toEqual([]);
  });

  test("a surviving target of the deleted move is kept (transposition delete)", () => {
    const snap = snapshotOf(["e4"]);
    const p1 = snap.positions[0]!;
    // Nothing but the top move: its target survived under another id and is reused by key.
    const plan = planRestore(
      {
        ...snap,
        positions: [],
        ideaNotes: [],
        basePositionId: null,
        moves: [{ ...snap.moves[0]!, toPositionId: "surv" }],
      },
      current({
        positions: [
          { id: "p0", positionKey: positionKey(START_FEN), fen: START_FEN },
          { id: "surv", positionKey: p1.positionKey, fen: p1.fen },
        ],
      }),
    );
    expect(plan.ok && plan.moves.map((m) => m.toPositionId)).toEqual(["surv"]);
  });

  test("rejects forged rows: wrong key, illegal move", () => {
    const snap = snapshotOf(["e4", "e5"]);
    const wrongKey = {
      ...snap,
      positions: [{ ...snap.positions[0]!, positionKey: "bogus" as never }, snap.positions[1]!],
    };
    expect(planRestore(wrongKey, current())).toEqual({ ok: false, reason: "invalid_snapshot" });
    const illegal = { ...snap, moves: [{ ...snap.moves[0]!, uci: "e2e5" }, snap.moves[1]!] };
    expect(planRestore(illegal, current())).toEqual({ ok: false, reason: "invalid_snapshot" });
  });
});
