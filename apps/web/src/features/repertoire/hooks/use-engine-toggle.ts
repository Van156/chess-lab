import { useSyncExternalStore } from "react";

import { createEnginePreferenceStore } from "../lib/engine-preference";

/** `localStorage` can throw on access (blocked storage); the store guards the lookup. */
const store = createEnginePreferenceStore(() => window.localStorage);

/** Also follows changes made in another tab. */
const subscribe = (listener: () => void) => {
  const unsubscribe = store.subscribe(listener);
  window.addEventListener("storage", listener);
  return () => {
    unsubscribe();
    window.removeEventListener("storage", listener);
  };
};

/** The server and the first hydration render use the default, so markup always matches. */
const getServerSnapshot = () => true;

/**
 * The viewer's engine on/off choice for the repertoire builder: on by default and remembered in
 * `localStorage` (a per-viewer convenience, not an account setting). It is SSR-safe and follows
 * changes made in another tab.
 */
export function useEngineToggle(): readonly [enabled: boolean, setEnabled: (on: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, store.getSnapshot, getServerSnapshot);
  return [enabled, store.set];
}
