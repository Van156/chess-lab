import type { PracticeSummary } from "../lib/practice-summary";

/** The day the fixtures treat as today. */
export const FIXTURE_TODAY = "2026-11-05";

/** A regular player: a five-day streak, practised today, a few gaps earlier in the month. */
export const ACTIVE_SUMMARY: PracticeSummary = {
  totalSessions: 46,
  totalDurationMs: (3 * 60 + 25) * 60_000,
  totalQuestions: 920,
  totalCorrect: 791,
  currentStreakDays: 5,
  practiceDays: [
    { day: "2026-10-09", sessions: 1 },
    { day: "2026-10-10", sessions: 2 },
    { day: "2026-10-13", sessions: 1 },
    { day: "2026-10-14", sessions: 3 },
    { day: "2026-10-15", sessions: 1 },
    { day: "2026-10-18", sessions: 2 },
    { day: "2026-10-21", sessions: 1 },
    { day: "2026-10-22", sessions: 1 },
    { day: "2026-10-24", sessions: 4 },
    { day: "2026-10-27", sessions: 1 },
    { day: "2026-10-28", sessions: 2 },
    { day: "2026-11-01", sessions: 1 },
    { day: "2026-11-02", sessions: 2 },
    { day: "2026-11-03", sessions: 1 },
    { day: "2026-11-04", sessions: 3 },
    { day: "2026-11-05", sessions: 1 },
  ],
};

/** Same player before today's first session. */
export const NOT_TODAY_SUMMARY: PracticeSummary = {
  ...ACTIVE_SUMMARY,
  currentStreakDays: 4,
  practiceDays: ACTIVE_SUMMARY.practiceDays.filter((entry) => entry.day !== FIXTURE_TODAY),
};

export const NEW_SUMMARY: PracticeSummary = {
  totalSessions: 0,
  totalDurationMs: 0,
  totalQuestions: 0,
  totalCorrect: 0,
  currentStreakDays: 0,
  practiceDays: [],
};
