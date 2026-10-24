export type ExplorerCacheOptions = {
  /** An entry younger than this is served without calling the loader. */
  ttlMs: number;
  /** An expired entry younger than this may still be served when the loader fails. */
  staleMaxMs: number;
  maxEntries: number;
  now?: () => number;
};

export type ExplorerCacheResult<T> = { value: T; stale: boolean };

type Entry<T> = { value: T; loadedAt: number };

/**
 * TTL + LRU cache for explorer answers. Pure: no I/O, the clock is injectable.
 * Concurrent loads for one key share a single promise, and a failed load falls
 * back to an older entry (stale) before giving up with the loader's own error.
 */
export function createExplorerCache<T>({
  ttlMs,
  staleMaxMs,
  maxEntries,
  now = Date.now,
}: ExplorerCacheOptions) {
  // Map iteration order is insertion order, so re-inserting marks most recently used.
  const entries = new Map<string, Entry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  function touch(key: string, entry: Entry<T>) {
    entries.delete(key);
    entries.set(key, entry);
  }

  function store(key: string, value: T) {
    touch(key, { value, loadedAt: now() });
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
  }

  async function get(key: string, load: () => Promise<T>): Promise<ExplorerCacheResult<T>> {
    const cached = entries.get(key);
    if (cached && now() - cached.loadedAt < ttlMs) {
      touch(key, cached);
      return { value: cached.value, stale: false };
    }

    let pending = inFlight.get(key);
    if (!pending) {
      pending = load().then(
        (value) => {
          inFlight.delete(key);
          store(key, value);
          return value;
        },
        (error: unknown) => {
          inFlight.delete(key);
          throw error;
        },
      );
      inFlight.set(key, pending);
    }

    try {
      return { value: await pending, stale: false };
    } catch (error) {
      const old = entries.get(key);
      if (old && now() - old.loadedAt < staleMaxMs) return { value: old.value, stale: true };
      entries.delete(key);
      throw error;
    }
  }

  return { get };
}
