import { describe, expect, test } from "bun:test";

import { selectQueue, type QueueCandidate } from "./queue";

const NOW = new Date("2026-03-10T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

let seq = 0;
function card(
  pillar: string,
  state: QueueCandidate["state"],
  dueMinutes: number,
  id = `c${seq++}`,
): QueueCandidate {
  return { cardId: id, pillar, state, due: at(dueMinutes) };
}
const ids = (q: QueueCandidate[]) => q.map((c) => c.cardId);
const base = { introducedToday: 0, dailyNewLimit: 20, now: NOW, limit: 100 };

describe("selectQueue", () => {
  test("returns nothing for empty input", () => {
    expect(selectQueue({ ...base, due: [], fresh: [] })).toEqual([]);
  });

  test("learning and relearning cards come first, oldest due first", () => {
    const review = card("mistakes", 2, -600, "review");
    const relearn = card("mistakes", 3, -5, "relearn");
    const learn = card("repertoire", 1, -30, "learn");
    const q = selectQueue({ ...base, due: [review, relearn, learn], fresh: [] });
    expect(ids(q)).toEqual(["learn", "relearn", "review"]);
  });

  test("a learning card not yet due sorts after the due learning cards", () => {
    const later = card("mistakes", 1, 90, "later");
    const ready = card("mistakes", 1, -1, "ready");
    const review = card("mistakes", 2, -60, "review");
    const q = selectQueue({ ...base, due: [later, review, ready], fresh: [] });
    expect(ids(q)[0]).toBe("ready");
    expect(ids(q)).toContain("later");
  });

  test("review cards follow, oldest due first within a pillar", () => {
    const a = card("mistakes", 2, -10, "a");
    const b = card("mistakes", 2, -100, "b");
    const q = selectQueue({ ...base, due: [a, b], fresh: [] });
    expect(ids(q)).toEqual(["b", "a"]);
  });

  test("new cards are capped by dailyNewLimit minus introducedToday", () => {
    const fresh = Array.from({ length: 10 }, () => card("mistakes", 0, 0));
    const q = selectQueue({ ...base, due: [], fresh, dailyNewLimit: 5, introducedToday: 2 });
    expect(q).toHaveLength(3);
  });

  test("no new cards once the limit is consumed", () => {
    const fresh = [card("mistakes", 0, 0)];
    const due = [card("mistakes", 2, -1, "r")];
    const q = selectQueue({ ...base, due, fresh, dailyNewLimit: 5, introducedToday: 5 });
    expect(ids(q)).toEqual(["r"]);
  });

  test("introducedToday above the limit never goes negative", () => {
    const fresh = [card("mistakes", 0, 0)];
    expect(selectQueue({ ...base, due: [], fresh, dailyNewLimit: 2, introducedToday: 9 })).toEqual(
      [],
    );
  });

  test("due cards are not capped by the new-card limit", () => {
    const due = Array.from({ length: 30 }, () => card("mistakes", 2, -1));
    const q = selectQueue({ ...base, due, fresh: [], dailyNewLimit: 0 });
    expect(q).toHaveLength(30);
  });

  test("new cards are interleaved evenly among review cards", () => {
    const due = Array.from({ length: 6 }, (_, i) => card("mistakes", 2, -100 + i, `r${i}`));
    const fresh = [card("mistakes", 0, 0, "n0"), card("mistakes", 0, 0, "n1")];
    const q = selectQueue({ ...base, due, fresh });
    const positions = ids(q)
      .map((id, i) => (id.startsWith("n") ? i : -1))
      .filter((i) => i >= 0);
    expect(q).toHaveLength(8);
    expect(positions).toEqual([2, 6]);
  });

  test("round-robin across pillars so none starves", () => {
    const due = [
      ...Array.from({ length: 4 }, (_, i) => card("mistakes", 2, -100 + i, `m${i}`)),
      ...Array.from({ length: 2 }, (_, i) => card("repertoire", 2, -50 + i, `p${i}`)),
      card("drills", 2, -10, "d0"),
    ];
    const q = selectQueue({ ...base, due, fresh: [], limit: 3 });
    expect(new Set(q.map((c) => c.pillar))).toEqual(new Set(["mistakes", "repertoire", "drills"]));
  });

  test("new cards also round-robin across pillars", () => {
    const fresh = [
      card("mistakes", 0, 0, "m0"),
      card("mistakes", 0, 0, "m1"),
      card("drills", 0, 0, "d0"),
    ];
    const q = selectQueue({ ...base, due: [], fresh, dailyNewLimit: 2 });
    expect(new Set(q.map((c) => c.pillar))).toEqual(new Set(["mistakes", "drills"]));
  });

  test("limit is honoured, learning cards win under a tight limit", () => {
    const learn = card("mistakes", 1, -5, "learn");
    const due = [learn, ...Array.from({ length: 5 }, () => card("mistakes", 2, -1))];
    const q = selectQueue({ ...base, due, fresh: [card("drills", 0, 0)], limit: 2 });
    expect(q).toHaveLength(2);
    expect(q[0]?.cardId).toBe("learn");
  });

  test("limit 0 returns nothing", () => {
    expect(selectQueue({ ...base, due: [card("mistakes", 2, -1)], fresh: [], limit: 0 })).toEqual(
      [],
    );
  });

  test("is deterministic and does not mutate its input", () => {
    const due = [card("mistakes", 2, -5, "a"), card("repertoire", 2, -5, "b")];
    const fresh = [card("drills", 0, 0, "n")];
    const snapshot = structuredClone({ due, fresh });
    const first = selectQueue({ ...base, due, fresh });
    const second = selectQueue({ ...base, due: [...due].reverse(), fresh });
    expect(ids(first)).toEqual(ids(second));
    expect({ due, fresh }).toEqual(snapshot);
  });
});
