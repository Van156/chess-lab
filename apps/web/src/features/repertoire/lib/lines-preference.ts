import {
  createPreferenceStore,
  readPreference,
  writePreference,
  type PreferenceCodec,
  type PreferenceStorage,
  type PreferenceStore,
} from "./preference-store";

export const LINE_COUNT_MIN = 1;
export const LINE_COUNT_MAX = 5;
export const LINE_COUNT_DEFAULT = 3;

/** Where the number of engine lines lives; namespaced so it never collides with other keys. */
export const LINE_COUNT_KEY = "chess-lab:repertoire:engine-lines";
/** Where the repertoire-arrows on/off choice lives. */
export const REPERTOIRE_ARROWS_KEY = "chess-lab:repertoire:repertoire-arrows";

/** A whole number from 1 to 5; anything that is not a number gives the default. */
export function clampLineCount(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return LINE_COUNT_DEFAULT;
  return Math.floor(Math.min(LINE_COUNT_MAX, Math.max(LINE_COUNT_MIN, value)));
}

const lineCountCodec: PreferenceCodec<number> = {
  key: LINE_COUNT_KEY,
  defaultValue: LINE_COUNT_DEFAULT,
  parse: (raw) =>
    raw === null || raw.trim() === "" ? LINE_COUNT_DEFAULT : clampLineCount(Number(raw)),
  serialize: (count) => String(clampLineCount(count)),
};

/** On unless the saved value says "off", so an unknown value counts as on. */
const repertoireArrowsCodec: PreferenceCodec<boolean> = {
  key: REPERTOIRE_ARROWS_KEY,
  defaultValue: true,
  parse: (raw) => raw !== "off",
  serialize: (on) => (on ? "on" : "off"),
};

/** The saved number of engine lines, 1 to 5; 3 when nothing usable is saved. */
export function readLineCount(storage: PreferenceStorage | null): number {
  return readPreference(storage, lineCountCodec);
}

/** Saves the (clamped) number of lines; returns false when storage refuses. */
export function writeLineCount(storage: PreferenceStorage | null, count: number): boolean {
  return writePreference(storage, lineCountCodec, count);
}

/** The saved repertoire-arrows choice; on when nothing usable is saved. */
export function readRepertoireArrows(storage: PreferenceStorage | null): boolean {
  return readPreference(storage, repertoireArrowsCodec);
}

/** Saves the choice; returns false when storage refuses. */
export function writeRepertoireArrows(storage: PreferenceStorage | null, on: boolean): boolean {
  return writePreference(storage, repertoireArrowsCodec, on);
}

export function createLineCountStore(
  getStorage: () => PreferenceStorage | null,
): PreferenceStore<number> {
  return createPreferenceStore(getStorage, lineCountCodec);
}

export function createRepertoireArrowsStore(
  getStorage: () => PreferenceStorage | null,
): PreferenceStore<boolean> {
  return createPreferenceStore(getStorage, repertoireArrowsCodec);
}
