/**
 * How the paged games and mistakes lists react to a completed analysis. An infinite query
 * refetches every loaded page, so a user who paged deep would trigger one request per page for
 * each analysed game. Short lists refresh live; deep ones are only marked stale and refetch on the
 * next mount or focus.
 */
export const LIVE_REFRESH_MAX_PAGES = 2;

/** `loadedPages` holds the page count of each cached list matching the key. */
export const listRefetchType = (loadedPages: readonly number[]): "active" | "none" =>
  Math.max(0, ...loadedPages) > LIVE_REFRESH_MAX_PAGES ? "none" : "active";
