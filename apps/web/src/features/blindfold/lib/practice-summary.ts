/** One calendar day of practice, as `blindfold.summary` returns it. */
export type PracticeDay = { day: string; sessions: number };

/** All-time blindfold practice, as `blindfold.summary` returns it. */
export type PracticeSummary = {
  totalSessions: number;
  totalDurationMs: number;
  totalQuestions: number;
  totalCorrect: number;
  currentStreakDays: number;
  /** Days with at least one session (`day` is `YYYY-MM-DD`); missing days had none. */
  practiceDays: readonly PracticeDay[];
};

/** How many days the practice strip shows. */
export const STRIP_DAYS = 28;

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` for the UTC day of `date`; `blindfold.summary` counts practice days in UTC. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function shiftDay(day: string, offset: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The last `length` days ending on `today`, oldest first, each with its session count (0 for a
 * day without practice). Days outside the window are ignored.
 */
export function practiceStrip(
  practiceDays: readonly PracticeDay[],
  today: string,
  length = STRIP_DAYS,
): PracticeDay[] {
  const sessionsByDay = new Map(practiceDays.map((entry) => [entry.day, entry.sessions]));
  return Array.from({ length }, (_, index) => {
    const day = shiftDay(today, index - length + 1);
    return { day, sessions: sessionsByDay.get(day) ?? 0 };
  });
}

/** Total practice time in words: `"under a minute"`, `"45 min"` or `"2 h 5 min"`. */
export function formatPracticeTime(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes === 0) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Practice time as number-and-unit parts for a compact stat, e.g. `[3 h, 25 min]`. */
export function practiceTimeParts(ms: number): { value: number; unit: string }[] {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return [{ value: minutes, unit: "min" }];
  const rest = minutes % 60;
  return rest === 0
    ? [{ value: hours, unit: "h" }]
    : [
        { value: hours, unit: "h" },
        { value: rest, unit: "min" },
      ];
}

/** Accuracy over every question ever answered, in [0, 1]; null before the first answer. */
export function overallAccuracy(summary: Pick<PracticeSummary, "totalQuestions" | "totalCorrect">) {
  return summary.totalQuestions === 0 ? null : summary.totalCorrect / summary.totalQuestions;
}
