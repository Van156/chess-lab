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
