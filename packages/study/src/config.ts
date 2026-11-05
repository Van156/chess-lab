/** Default number of brand-new cards introduced per local day. */
export const DEFAULT_DAILY_NEW_CARDS = 20;

/** Tunable FSRS inputs, mapped onto ts-fsrs parameters by `fsrs.ts`. */
export type StudyParams = {
  desiredRetention: number;
  maximumInterval: number;
  enableFuzz: boolean;
};

export const DEFAULT_STUDY_PARAMS: StudyParams = {
  desiredRetention: 0.9,
  maximumInterval: 365,
  enableFuzz: true,
};

/** A client clock may run ahead of the server by at most this much. */
export const MAX_REVIEW_CLOCK_SKEW_MS = 5 * 60 * 1000;

/** Server cap for one `review.queue` page (ADR-14); the web client pages within it. */
export const QUEUE_MAX_PAGE_SIZE = 200;

/** Server cap for `elapsedMs` of one grade (one hour); anything longer is a forgotten tab. */
export const MAX_ELAPSED_MS = 3_600_000;
