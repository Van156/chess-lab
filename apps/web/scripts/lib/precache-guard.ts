/**
 * Build guard for the service worker precache. The opening book (~460 kB, builder only) must stay
 * out of it and live in its own lazy chunk. The check looks at file contents, not names, so it
 * holds whatever the data module or the chunk is called.
 */

/** A string every generated book contains and ordinary app code does not. */
export const OPENING_BOOK_MARKER = "Scotch Game";

/** The `url` of every entry in the Workbox precache manifest inside `sw.js`, bare or quoted key. */
export function parsePrecachedUrls(swSource: string): string[] {
  return [...swSource.matchAll(/(?:\burl|"url"|'url')\s*:\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
}

export type PlacementResult = { ok: true; bookFiles: string[] } | { ok: false; error: string };

/** Both maps are file path -> text. `precached` holds the precached JS, `lazy` every other asset. */
export function checkOpeningBookPlacement(files: {
  precached: Record<string, string>;
  lazy: Record<string, string>;
}): PlacementResult {
  // The app bundle is always precached, so an empty set means the manifest was not read: fail
  // rather than pass having checked nothing.
  if (Object.keys(files.precached).length === 0) {
    return { ok: false, error: "no precached JS found; the precache manifest could not be read" };
  }
  const holdsBook = (group: Record<string, string>) =>
    Object.keys(group).filter((file) => group[file].includes(OPENING_BOOK_MARKER));
  const precachedBook = holdsBook(files.precached);
  if (precachedBook.length > 0) {
    return {
      ok: false,
      error: `the opening book is in the service worker precache: ${precachedBook.join(", ")}`,
    };
  }
  const bookFiles = holdsBook(files.lazy);
  if (bookFiles.length === 0) {
    return {
      ok: false,
      error: "the opening book is not in its own lazy chunk (no non-precached asset holds it)",
    };
  }
  return { ok: true, bookFiles };
}
