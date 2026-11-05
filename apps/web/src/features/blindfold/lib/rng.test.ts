import { describe, expect, test } from "bun:test";

import { createRng } from "./rng";

describe("createRng", () => {
  test("the same seed gives the same sequence", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  test("different seeds give different sequences", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  test("next() is in [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  test("int(n) is an integer in [0, n) and reaches every value", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const value = rng.int(6);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("pick() returns an element of the list", () => {
    const rng = createRng(9);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });
});
