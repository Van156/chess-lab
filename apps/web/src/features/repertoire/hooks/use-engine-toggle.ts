import { useCallback, useSyncExternalStore } from "react";

import { readEnginePreference, writeEnginePreference } from "../lib/engine-preference";

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

/** `localStorage` can throw on access (blocked storage), so even getting it is guarded. */
const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** The server and the first hydration render use the default, so markup always matches. */
const getServerSnapshot = () => true;

// Without a writable storage the choice would not stick, so it is also kept for this page view.
let fallback: boolean | null = null;
const getSnapshot = () => fallback ?? readEnginePreference(storage());

/**
 * The viewer's engine on/off choice for the repertoire builder: on by default and remembered in
 * `localStorage` (a per-viewer convenience, not an account setting). It is SSR-safe and follows
 * changes made in another tab.
 */
export function useEngineToggle(): readonly [enabled: boolean, setEnabled: (on: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setEnabled = useCallback((on: boolean) => {
    fallback = writeEnginePreference(storage(), on) ? null : on;
    for (const listener of listeners) listener();
  }, []);
  return [enabled, setEnabled];
}
