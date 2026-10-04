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
