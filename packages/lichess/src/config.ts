/** Base pause after a 429 (Lichess guidance: wait a full minute). Doubles per consecutive 429. */
export const RATE_LIMIT_PAUSE_MS = 60_000;

/** Longest pause the backoff may reach. */
export const RATE_LIMIT_MAX_PAUSE_MS = 5 * 60_000;

/** Retries after the first 429 before giving up with `LichessRateLimited`. */
export const MAX_429_RETRIES = 3;

export const LICHESS_BASE_URL = "https://lichess.org";
export const LICHESS_EXPLORER_URL = "https://explorer.lichess.org/lichess";

/** Moves requested per explorer position (the documented Lichess default). */
export const EXPLORER_MOVES = 12;

/** How long a cached explorer answer is served without asking Lichess again. */
export const EXPLORER_CACHE_TTL_MS = 24 * 60 * 60_000;

/** Most explorer answers the server keeps; the least recently used go first. */
export const EXPLORER_CACHE_MAX_ENTRIES = 5000;

/** Oldest cached answer still served when Lichess is rate limited or failing. */
export const EXPLORER_STALE_MAX_MS = 7 * 24 * 60 * 60_000;

/** Longest an interactive explorer request waits for an answer before serving stale or giving up. */
export const EXPLORER_WAIT_MS = 5000;
