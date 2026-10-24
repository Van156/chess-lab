import { describe, expect, test } from "bun:test";

import {
  ENGINE_PREFERENCE_KEY,
  readEnginePreference,
  writeEnginePreference,
  type PreferenceStorage,
} from "./engine-preference";

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

describe("engine preference", () => {
  test("defaults to on when nothing is saved or storage is missing", () => {
    expect(readEnginePreference(memory())).toBe(true);
    expect(readEnginePreference(null)).toBe(true);
  });

  test("round-trips the choice under a namespaced key", () => {
    const storage = memory();
    expect(writeEnginePreference(storage, false)).toBe(true);
    expect(storage.data.get(ENGINE_PREFERENCE_KEY)).toBe("off");
    expect(ENGINE_PREFERENCE_KEY).toContain(":");
    expect(readEnginePreference(storage)).toBe(false);
    writeEnginePreference(storage, true);
    expect(readEnginePreference(storage)).toBe(true);
  });

  test("an unknown saved value counts as on", () => {
    const storage = memory();
    storage.data.set(ENGINE_PREFERENCE_KEY, "banana");
    expect(readEnginePreference(storage)).toBe(true);
  });

  test("never throws when storage throws", () => {
    expect(readEnginePreference(throwing)).toBe(true);
    expect(writeEnginePreference(throwing, false)).toBe(false);
    expect(writeEnginePreference(null, false)).toBe(false);
  });
});
