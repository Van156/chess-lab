import { describe, expect, test } from "bun:test";

import { createExplorerCache } from "./explorer-cache";

const TTL = 1_000;
const STALE = 10_000;

function setup(maxEntries = 3) {
  const clock = { now: 0 };
  const cache = createExplorerCache<string>({
    ttlMs: TTL,
    staleMaxMs: STALE,
    maxEntries,
    now: () => clock.now,
  });
  return { cache, clock };
}

function counting(value: string) {
  const state = { calls: 0 };
  return {
    state,
    load: async () => {
      state.calls += 1;
      return value;
    },
  };
}

describe("createExplorerCache", () => {
  test("a fresh hit skips the loader", async () => {
    const { cache, clock } = setup();
    const a = counting("A");
    await cache.get("k", a.load);
    clock.now = TTL - 1;
    expect(await cache.get("k", a.load)).toEqual({ value: "A", stale: false });
    expect(a.state.calls).toBe(1);
  });

  test("an expired entry is reloaded", async () => {
    const { cache, clock } = setup();
    await cache.get("k", async () => "old");
    clock.now = TTL;
    expect(await cache.get("k", async () => "new")).toEqual({ value: "new", stale: false });
  });

  test("concurrent gets for one key share a single load", async () => {
    const { cache } = setup();
    let calls = 0;
    let release!: (v: string) => void;
    const load = () => {
      calls += 1;
      return new Promise<string>((resolve) => {
        release = resolve;
      });
    };
    const first = cache.get("k", load);
    const second = cache.get("k", load);
    release("shared");
    expect(await first).toEqual({ value: "shared", stale: false });
    expect(await second).toEqual({ value: "shared", stale: false });
    expect(calls).toBe(1);
  });

  test("a failed load with a usable entry serves it as stale", async () => {
    const { cache, clock } = setup();
    await cache.get("k", async () => "old");
    clock.now = TTL + 5;
    const result = await cache.get("k", async () => {
      throw new Error("down");
    });
    expect(result).toEqual({ value: "old", stale: true });
  });

  test("a failed load with no entry rejects with the original error", async () => {
    const { cache } = setup();
    const error = new Error("down");
    await expect(
      cache.get("k", async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  test("a failed load with an entry older than the stale limit rejects", async () => {
    const { cache, clock } = setup();
    await cache.get("k", async () => "old");
    clock.now = STALE;
    const error = new Error("down");
    await expect(
      cache.get("k", async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  test("a failure does not poison later gets", async () => {
    const { cache } = setup();
    await cache
      .get("k", async () => {
        throw new Error("down");
      })
      .catch(() => {});
    const ok = counting("fine");
    expect(await cache.get("k", ok.load)).toEqual({ value: "fine", stale: false });
    expect(ok.state.calls).toBe(1);
  });

  test("the in-flight entry is cleared after a failure", async () => {
    const { cache } = setup();
    const failing = cache.get("k", async () => {
      throw new Error("down");
    });
    await failing.catch(() => {});
    const retry = counting("again");
    await cache.get("k", retry.load);
    expect(retry.state.calls).toBe(1);
  });

  test("evicts the least recently used entry beyond capacity", async () => {
    const { cache } = setup(2);
    const a = counting("A");
    await cache.get("a", a.load);
    await cache.get("b", async () => "B");
    await cache.get("c", async () => "C");
    await cache.get("a", a.load);
    expect(a.state.calls).toBe(2);
  });

  test("a hit refreshes recency so the other entry is evicted", async () => {
    const { cache } = setup(2);
    const a = counting("A");
    const b = counting("B");
    await cache.get("a", a.load);
    await cache.get("b", b.load);
    await cache.get("a", a.load);
    await cache.get("c", async () => "C");
    await cache.get("a", a.load);
    await cache.get("b", b.load);
    expect(a.state.calls).toBe(1);
    expect(b.state.calls).toBe(2);
  });
});
