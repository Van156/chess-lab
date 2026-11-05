import { useSyncExternalStore } from "react";

import type { PreferenceStore } from "../lib/preference-store";

/**
 * A hook over a saved viewer preference: SSR-safe (the server and the first hydration render use
 * `serverDefault`, so markup always matches) and it follows changes made in another tab. The
 * subscription is built once here, so React does not resubscribe on every render.
 */
export function createPreferenceHook<T>(
  store: PreferenceStore<T>,
  serverDefault: T,
): () => readonly [value: T, setValue: (value: T) => void] {
  const subscribe = (listener: () => void) => {
    const unsubscribe = store.subscribe(listener);
    window.addEventListener("storage", listener);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", listener);
    };
  };
  const getServerSnapshot = () => serverDefault;

  return () => [useSyncExternalStore(subscribe, store.getSnapshot, getServerSnapshot), store.set];
}
