/** Base pause after a 429 (Lichess guidance: wait a full minute). Doubles per consecutive 429. */
export const RATE_LIMIT_PAUSE_MS = 60_000;

/** Longest pause the backoff may reach. */
export const RATE_LIMIT_MAX_PAUSE_MS = 5 * 60_000;

/** Retries after the first 429 before giving up with `LichessRateLimited`. */
export const MAX_429_RETRIES = 3;

export const LICHESS_BASE_URL = "https://lichess.org";
export const LICHESS_EXPLORER_URL = "https://explorer.lichess.org/lichess";
