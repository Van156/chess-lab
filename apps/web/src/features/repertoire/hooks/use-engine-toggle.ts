import { createEnginePreferenceStore } from "../lib/engine-preference";

import { createPreferenceHook } from "./use-preference";

/**
 * The viewer's engine on/off choice for the repertoire builder: on by default and remembered in
 * `localStorage` (a per-viewer convenience, not an account setting). `localStorage` can throw on
 * access (blocked storage); the store guards the lookup.
 */
export const useEngineToggle = createPreferenceHook(
  createEnginePreferenceStore(() => window.localStorage),
  true,
);
