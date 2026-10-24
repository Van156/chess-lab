import {
  createPreferenceStore,
  readPreference,
  writePreference,
  type PreferenceCodec,
  type PreferenceStorage,
  type PreferenceStore,
} from "./preference-store";

export type { PreferenceStorage };

/** Where the viewer's engine on/off choice lives; namespaced so it never collides with other keys. */
export const ENGINE_PREFERENCE_KEY = "chess-lab:repertoire:engine-suggestions";

/** On unless the saved value says "off", so an unknown value counts as on. */
const engineCodec: PreferenceCodec<boolean> = {
  key: ENGINE_PREFERENCE_KEY,
  defaultValue: true,
  parse: (raw) => raw !== "off",
  serialize: (on) => (on ? "on" : "off"),
};

/** The saved choice; on when nothing is saved, the value is unknown or storage is unavailable. */
export function readEnginePreference(storage: PreferenceStorage | null): boolean {
  return readPreference(storage, engineCodec);
}

/** Saves the choice; returns false when storage refuses (private mode, quota), which is harmless. */
export function writeEnginePreference(storage: PreferenceStorage | null, on: boolean): boolean {
  return writePreference(storage, engineCodec, on);
}

/** A store in the shape `useSyncExternalStore` expects, over the saved engine choice. */
export type EnginePreferenceStore = PreferenceStore<boolean>;

/** The engine choice as an external store; see `createPreferenceStore` for the storage handling. */
export function createEnginePreferenceStore(
  getStorage: () => PreferenceStorage | null,
): EnginePreferenceStore {
  return createPreferenceStore(getStorage, engineCodec);
}
