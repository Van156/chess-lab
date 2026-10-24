/** Where the viewer's engine on/off choice lives; namespaced so it never collides with other keys. */
export const ENGINE_PREFERENCE_KEY = "chess-lab:repertoire:engine-suggestions";

/** The part of `Storage` this module uses, so tests can pass a fake. */
export type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

/** The saved choice; on when nothing is saved, the value is unknown or storage is unavailable. */
export function readEnginePreference(storage: PreferenceStorage | null): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(ENGINE_PREFERENCE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Saves the choice; returns false when storage refuses (private mode, quota), which is harmless. */
export function writeEnginePreference(storage: PreferenceStorage | null, on: boolean): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ENGINE_PREFERENCE_KEY, on ? "on" : "off");
    return true;
  } catch {
    return false;
  }
}

/** A store in the shape `useSyncExternalStore` expects, over the saved engine choice. */
export interface EnginePreferenceStore {
  getSnapshot: () => boolean;
  subscribe: (listener: () => void) => () => void;
  set: (on: boolean) => void;
}

/**
 * The engine choice as an external store. Storage is injected as a getter, because merely reading
 * `window.localStorage` can throw (blocked storage), so the guard lives with the caller's lookup.
 * Without a writable storage the choice would not stick, so it is also kept for this page view
 * until a later write succeeds.
 */
export function createEnginePreferenceStore(
  getStorage: () => PreferenceStorage | null,
): EnginePreferenceStore {
  const listeners = new Set<() => void>();
  let fallback: boolean | null = null;

  const storage = (): PreferenceStorage | null => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };

  return {
    getSnapshot: () => fallback ?? readEnginePreference(storage()),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    set: (on) => {
      fallback = writeEnginePreference(storage(), on) ? null : on;
      for (const listener of listeners) listener();
    },
  };
}
