import { DRILL_CATEGORIES, type DrillCategoryInfo, type DrillInfo } from "./drill-catalog";
import { formatPercent } from "./format";
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
  /** When the drill was last played; missing or null before the first session. */
  lastPlayedAt?: string | Date | null;
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

/** The stat for one drill, if `blindfold.stats` returned one. */
export function statFor(stats: readonly DrillStat[], kind: DrillKind): DrillStat | undefined {
  return stats.find((stat) => stat.drill === kind);
}

/** Best accuracy so far for one drill; null when it was never played. */
export function bestAccuracyFor(stats: readonly DrillStat[], kind: DrillKind): number | null {
  return statFor(stats, kind)?.bestAccuracy ?? null;
}

/** Drills in catalogue order, grouped under their category; empty categories are dropped. */
export function groupDrillsByCategory(
  drills: readonly DrillInfo[],
): { category: DrillCategoryInfo; drills: DrillInfo[] }[] {
  return DRILL_CATEGORIES.map((category) => ({
    category,
    drills: drills.filter((drill) => drill.category === category.id),
  })).filter((group) => group.drills.length > 0);
}

/** Sessions played across every drill, and how many drills were played at least once. */
export function totals(stats: readonly DrillStat[]): { sessions: number; drillsPlayed: number } {
  return {
    sessions: stats.reduce((sum, stat) => sum + stat.sessions, 0),
    drillsPlayed: stats.filter((stat) => stat.sessions > 0).length,
  };
}

/** A sentence describing recent accuracy for screen readers, oldest first. */
export function trendSummary(points: readonly { accuracy: number }[]): string {
  if (points.length === 0) return "No recent sessions.";
  const values = points.map((point) => formatPercent(point.accuracy)).join(", ");
  const count =
    points.length === 1 ? "Last session" : `Last ${points.length} sessions, oldest first`;
  if (points.length === 1) return `${count}: ${values}.`;
  const change = Math.round((points.at(-1)!.accuracy - points[0]!.accuracy) * 100);
  const direction =
    change === 0 ? "level" : change > 0 ? `up ${change} points` : `down ${-change} points`;
  return `${count}: ${values}; ${direction}.`;
}
