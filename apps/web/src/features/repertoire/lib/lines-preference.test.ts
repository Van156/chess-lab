import { describe, expect, test } from "bun:test";

import type { PreferenceStorage } from "./engine-preference";
import {
  LINE_COUNT_DEFAULT,
  LINE_COUNT_KEY,
  REPERTOIRE_ARROWS_KEY,
  clampLineCount,
  createLineCountStore,
  createRepertoireArrowsStore,
  readLineCount,
  readRepertoireArrows,
  writeLineCount,
  writeRepertoireArrows,
} from "./lines-preference";

const memory = (): PreferenceStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
};

const throwing: PreferenceStorage = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
};

describe("clampLineCount", () => {
  test("keeps 1 to 5 and rounds a fraction down", () => {
    expect([1, 2, 3, 4, 5].map(clampLineCount)).toEqual([1, 2, 3, 4, 5]);
    expect(clampLineCount(2.9)).toBe(2);
  });

  test("pulls out-of-range counts to the nearest end", () => {
    expect(clampLineCount(0)).toBe(1);
    expect(clampLineCount(-4)).toBe(1);
    expect(clampLineCount(6)).toBe(5);
    expect(clampLineCount(Infinity)).toBe(5);
  });

  test("falls back to the default for values that are not numbers", () => {
    expect(clampLineCount(NaN)).toBe(LINE_COUNT_DEFAULT);
    expect(clampLineCount(undefined as unknown as number)).toBe(LINE_COUNT_DEFAULT);
    expect(LINE_COUNT_DEFAULT).toBe(3);
  });
});

describe("line count preference", () => {
  test("defaults to 3 when nothing is saved or storage is missing", () => {
    expect(readLineCount(memory())).toBe(3);
    expect(readLineCount(null)).toBe(3);
  });

  test("round-trips under a namespaced key", () => {
    const storage = memory();
    expect(writeLineCount(storage, 5)).toBe(true);
    expect(storage.data.get(LINE_COUNT_KEY)).toBe("5");
    expect(LINE_COUNT_KEY).toContain(":");
    expect(readLineCount(storage)).toBe(5);
  });

  test("clamps what it saves and what it reads back", () => {
    const storage = memory();
    writeLineCount(storage, 9);
    expect(storage.data.get(LINE_COUNT_KEY)).toBe("5");
    storage.data.set(LINE_COUNT_KEY, "0");
    expect(readLineCount(storage)).toBe(1);
    storage.data.set(LINE_COUNT_KEY, "banana");
    expect(readLineCount(storage)).toBe(3);
    storage.data.set(LINE_COUNT_KEY, "");
    expect(readLineCount(storage)).toBe(3);
  });

  test("never throws when storage throws", () => {
    expect(readLineCount(throwing)).toBe(3);
    expect(writeLineCount(throwing, 2)).toBe(false);
    expect(writeLineCount(null, 2)).toBe(false);
  });
});

describe("repertoire arrows preference", () => {
  test("defaults to on when nothing is saved, the value is unknown or storage fails", () => {
    const storage = memory();
    expect(readRepertoireArrows(storage)).toBe(true);
    expect(readRepertoireArrows(null)).toBe(true);
    expect(readRepertoireArrows(throwing)).toBe(true);
    storage.data.set(REPERTOIRE_ARROWS_KEY, "banana");
    expect(readRepertoireArrows(storage)).toBe(true);
  });

  test("round-trips the choice under its own namespaced key", () => {
    const storage = memory();
    expect(writeRepertoireArrows(storage, false)).toBe(true);
    expect(storage.data.get(REPERTOIRE_ARROWS_KEY)).toBe("off");
    expect(readRepertoireArrows(storage)).toBe(false);
    writeRepertoireArrows(storage, true);
    expect(readRepertoireArrows(storage)).toBe(true);
    expect(REPERTOIRE_ARROWS_KEY).not.toBe(LINE_COUNT_KEY);
  });

  test("never throws when a write fails", () => {
    expect(writeRepertoireArrows(throwing, false)).toBe(false);
    expect(writeRepertoireArrows(null, false)).toBe(false);
  });
});

describe("line count store", () => {
  test("is 3 by default and persists a choice for the next store", () => {
    const storage = memory();
    const store = createLineCountStore(() => storage);
    expect(store.getSnapshot()).toBe(3);
    store.set(5);
    expect(store.getSnapshot()).toBe(5);
    expect(createLineCountStore(() => storage).getSnapshot()).toBe(5);
  });

  test("clamps what is set, so an out-of-range value never reaches the snapshot", () => {
    const store = createLineCountStore(() => throwing);
    store.set(0);
    expect(store.getSnapshot()).toBe(1);
    store.set(6);
    expect(store.getSnapshot()).toBe(5);
    store.set(NaN);
    expect(store.getSnapshot()).toBe(3);
  });

  test("keeps the choice for the page view when a write fails", () => {
    const store = createLineCountStore(() => throwing);
    store.set(4);
    expect(store.getSnapshot()).toBe(4);
  });

  test("keeps the default and still accepts a choice when storage access throws", () => {
    const store = createLineCountStore(() => {
      throw new Error("blocked");
    });
    expect(store.getSnapshot()).toBe(3);
    store.set(2);
    expect(store.getSnapshot()).toBe(2);
  });

  test("notifies subscribers on set until they unsubscribe", () => {
    const store = createLineCountStore(() => memory());
    let calls = 0;
    const unsubscribe = store.subscribe(() => (calls += 1));
    store.set(2);
    unsubscribe();
    store.set(4);
    expect(calls).toBe(1);
  });
});

describe("repertoire arrows store", () => {
  test("is on by default, persists and falls back when a write fails", () => {
    const storage = memory();
    const store = createRepertoireArrowsStore(() => storage);
    expect(store.getSnapshot()).toBe(true);
    store.set(false);
    expect(createRepertoireArrowsStore(() => storage).getSnapshot()).toBe(false);

    const failing = createRepertoireArrowsStore(() => throwing);
    failing.set(false);
    expect(failing.getSnapshot()).toBe(false);
  });
});
