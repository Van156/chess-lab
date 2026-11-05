import { describe, expect, test } from "bun:test";

import {
  ENGINE_PREFERENCE_KEY,
  createEnginePreferenceStore,
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

describe("engine preference store", () => {
  test("is on by default", () => {
    expect(createEnginePreferenceStore(() => memory()).getSnapshot()).toBe(true);
  });

  test("a successful write round-trips through storage", () => {
    const storage = memory();
    const store = createEnginePreferenceStore(() => storage);
    store.set(false);
    expect(storage.data.get(ENGINE_PREFERENCE_KEY)).toBe("off");
    expect(store.getSnapshot()).toBe(false);
    expect(createEnginePreferenceStore(() => storage).getSnapshot()).toBe(false);
  });

  test("keeps the choice for the page view when a write fails", () => {
    const store = createEnginePreferenceStore(() => throwing);
    store.set(false);
    expect(store.getSnapshot()).toBe(false);
    store.set(true);
    expect(store.getSnapshot()).toBe(true);
  });

  test("keeps the default and still accepts a choice when storage access throws", () => {
    const store = createEnginePreferenceStore(() => {
      throw new Error("blocked");
    });
    expect(store.getSnapshot()).toBe(true);
    store.set(false);
    expect(store.getSnapshot()).toBe(false);
  });

  test("notifies subscribers on set until they unsubscribe", () => {
    const store = createEnginePreferenceStore(() => memory());
    let calls = 0;
    const unsubscribe = store.subscribe(() => (calls += 1));
    store.set(false);
    expect(calls).toBe(1);
    unsubscribe();
    store.set(true);
    expect(calls).toBe(1);
  });

  test("a later successful write clears the fallback", () => {
    const storage = memory();
    let writable = false;
    const flaky: PreferenceStorage = {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        if (!writable) throw new Error("quota");
        storage.setItem(key, value);
      },
    };
    const store = createEnginePreferenceStore(() => flaky);
    store.set(false);
    expect(store.getSnapshot()).toBe(false);
    writable = true;
    store.set(true);
    expect(storage.data.get(ENGINE_PREFERENCE_KEY)).toBe("on");
    // Another tab turns it off in storage: the cleared fallback no longer masks the saved value.
    storage.data.set(ENGINE_PREFERENCE_KEY, "off");
    expect(store.getSnapshot()).toBe(false);
  });
});
