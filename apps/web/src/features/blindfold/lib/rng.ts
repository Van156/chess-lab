/** Deterministic pseudo-random numbers (mulberry32), so generated drills are reproducible from a seed. */
export type Rng = {
  /** A float in [0, 1). */
  next: () => number;
  /** An integer in [0, bound). */
  int: (bound: number) => number;
  /** A random element of a non-empty list. */
  pick: <T>(items: readonly T[]) => T;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (bound: number) => Math.floor(next() * bound);
  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(items.length)];
    if (item === undefined) throw new Error("pick() needs a non-empty list");
    return item;
  };
  return { next, int, pick };
}
