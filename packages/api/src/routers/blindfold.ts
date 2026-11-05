import type { Database } from "@b2c-template/db";
import { DRILL_KINDS, drillSession } from "@b2c-template/db/schema/drills";
import type { DrillKind } from "@b2c-template/db/schema/drills";
import { and, desc, eq, max, sql } from "drizzle-orm";
import { z } from "zod";

import { featureProcedure } from "../index";

const blindfoldProcedure = featureProcedure("blindfold");

/** How many recent sessions `stats` returns for each drill. */
const RECENT_SESSIONS = 10;

/** How many UTC days, today included, `summary.practiceDays` covers. */
const PRACTICE_WINDOW_DAYS = 28;

const DAY_MS = 86_400_000;

const recordInput = z
  .object({
    drill: z.enum(DRILL_KINDS),
    level: z.int().min(1).max(32_767),
    correct: z.int().min(0).max(32_767),
    total: z.int().min(1).max(32_767),
    durationMs: z.int().min(0),
  })
  .refine((input) => input.correct <= input.total, {
    message: "correct cannot exceed total.",
    path: ["correct"],
  });

export type BlindfoldRouterDeps = { now?: () => Date };

/** Blindfold drill progress: record a finished session, summarise each drill and overall practice. */
export function createBlindfoldRouter({ now = () => new Date() }: BlindfoldRouterDeps = {}) {
  return {
    recordSession: blindfoldProcedure.input(recordInput).handler(async ({ input, context }) => {
      const [row] = await context.db
        .insert(drillSession)
        .values({ ...input, userId: context.session.user.id })
        .returning();
      return row!;
    }),
    stats: blindfoldProcedure.handler(async ({ context }) => {
      const userId = context.session.user.id;
      const [aggregates, recents] = await Promise.all([
        context.db
          .select({
            drill: drillSession.drill,
            sessions: sql<number>`count(*)::int`,
            bestAccuracy: sql<number>`max(${drillSession.correct}::float8 / ${drillSession.total})`,
            lastPlayedAt: max(drillSession.createdAt),
          })
          .from(drillSession)
          .where(eq(drillSession.userId, userId))
          .groupBy(drillSession.drill),
        Promise.all(DRILL_KINDS.map((drill) => recentSessions(context.db, userId, drill))),
      ]);
      return DRILL_KINDS.map((drill, index) => {
        const aggregate = aggregates.find((row) => row.drill === drill);
        return {
          drill,
          sessions: aggregate?.sessions ?? 0,
          bestAccuracy: aggregate?.bestAccuracy ?? null,
          recent: recents[index]!,
          lastPlayedAt: aggregate?.lastPlayedAt ?? null,
        };
      });
    }),
    summary: blindfoldProcedure.handler(({ context }) =>
      practiceSummary(context.db, context.session.user.id, now()),
    ),
  };
}

export const blindfoldRouter = createBlindfoldRouter();

/** A UTC calendar day as `YYYY-MM-DD`. */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Lifetime totals, the current daily streak and per-day counts for the last 28 UTC days. */
async function practiceSummary(db: Database, userId: string, now: Date) {
  const day = sql<string>`to_char(${drillSession.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const [[totals], days] = await Promise.all([
    db
      .select({
        totalSessions: sql<number>`count(*)::int`,
        totalDurationMs: sql<number>`coalesce(sum(${drillSession.durationMs}), 0)::float8`,
        totalQuestions: sql<number>`coalesce(sum(${drillSession.total}), 0)::int`,
        totalCorrect: sql<number>`coalesce(sum(${drillSession.correct}), 0)::int`,
      })
      .from(drillSession)
      .where(eq(drillSession.userId, userId)),
    db
      .select({ day, sessions: sql<number>`count(*)::int` })
      .from(drillSession)
      .where(eq(drillSession.userId, userId))
      .groupBy(day)
      .orderBy(day),
  ]);

  const today = utcDay(now);
  const windowStart = utcDay(new Date(now.getTime() - (PRACTICE_WINDOW_DAYS - 1) * DAY_MS));
  return {
    ...totals!,
    currentStreakDays: streakDays(new Set(days.map((row) => row.day)), now),
    practiceDays: days.filter((row) => row.day >= windowStart && row.day <= today),
  };
}

/** Consecutive practised UTC days ending today, or yesterday when today has no session yet. */
function streakDays(practised: ReadonlySet<string>, now: Date): number {
  let cursor = now.getTime();
  if (!practised.has(utcDay(now))) {
    cursor -= DAY_MS;
  }
  let streak = 0;
  while (practised.has(utcDay(new Date(cursor)))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function recentSessions(db: Database, userId: string, drill: DrillKind) {
  return db
    .select()
    .from(drillSession)
    .where(and(eq(drillSession.userId, userId), eq(drillSession.drill, drill)))
    .orderBy(desc(drillSession.createdAt))
    .limit(RECENT_SESSIONS);
}
