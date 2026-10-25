import type { DrillKind } from "./questions";
import { accuracy } from "./score";

/** One saved session, as `blindfold.stats` returns it (extra fields are ignored). */
export type RecentSession = { id: string; correct: number; total: number; durationMs: number };

/** Per-drill progress, as `blindfold.stats` returns it. `recent` is newest first. */
export type DrillStat = {
  drill: DrillKind;
  sessions: number;
  /** Best accuracy in [0, 1]; null before the first session. */
  bestAccuracy: number | null;
  recent: readonly RecentSession[];
};

/** Accuracy of each recent session, oldest first, so a trend reads left to right. */
export function recentAccuracies(
  recent: readonly RecentSession[],
): { id: string; accuracy: number }[] {
  return recent.toReversed().map((session) => ({ id: session.id, accuracy: accuracy(session) }));
}

/** Whether any drill has been played at all. */
export function hasAnySessions(stats: readonly DrillStat[]): boolean {
  return stats.some((stat) => stat.sessions > 0);
}
