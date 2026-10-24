/** The part of `Storage` the preferences use, so tests can pass a fake. */
export type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

/** How one preference is saved: its key, its default and the text form of its value. */
export interface PreferenceCodec<T> {
  /** Namespaced so it never collides with other keys. */
  key: string;
  defaultValue: T;
  /** Reads the saved text; `null` (nothing saved) and unknown text give a valid value. */
  parse: (raw: string | null) => T;
  serialize: (value: T) => string;
}

/** The saved value; the default when nothing is saved, the value is unknown or storage fails. */
export function readPreference<T>(storage: PreferenceStorage | null, codec: PreferenceCodec<T>): T {
  if (!storage) return codec.defaultValue;
  try {
    return codec.parse(storage.getItem(codec.key));
  } catch {
    return codec.defaultValue;
  }
}

/** Saves the value; returns false when storage refuses (private mode, quota), which is harmless. */
export function writePreference<T>(
  storage: PreferenceStorage | null,
  codec: PreferenceCodec<T>,
  value: T,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(codec.key, codec.serialize(value));
    return true;
  } catch {
    return false;
  }
}

/** A store in the shape `useSyncExternalStore` expects, over one saved preference. */
export interface PreferenceStore<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  set: (value: T) => void;
}

/**
 * A preference as an external store. Storage is injected as a getter, because merely reading
 * `window.localStorage` can throw (blocked storage), so the guard lives with the caller's lookup.
 * Without a writable storage the choice would not stick, so it is also kept for this page view
 * until a later write succeeds. A value passes through the codec's text form before it is used, so
 * whatever the codec cannot represent (an out-of-range number, say) never reaches the snapshot.
 */
export function createPreferenceStore<T>(
  getStorage: () => PreferenceStorage | null,
  codec: PreferenceCodec<T>,
): PreferenceStore<T> {
  const listeners = new Set<() => void>();
  let fallback: { value: T } | null = null;

  const storage = (): PreferenceStorage | null => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };

  return {
    getSnapshot: () => (fallback ? fallback.value : readPreference(storage(), codec)),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    set: (value) => {
      const valid = codec.parse(codec.serialize(value));
      fallback = writePreference(storage(), codec, valid) ? null : { value: valid };
      for (const listener of listeners) listener();
    },
  };
}
