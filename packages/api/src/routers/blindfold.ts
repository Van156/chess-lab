import type { Database } from "@b2c-template/db";
import { DRILL_KINDS, drillSession } from "@b2c-template/db/schema/drills";
import type { DrillKind } from "@b2c-template/db/schema/drills";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { featureProcedure } from "../index";

const blindfoldProcedure = featureProcedure("blindfold");

/** How many recent sessions `stats` returns for each drill. */
const RECENT_SESSIONS = 10;

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

/** Blindfold drill progress: record a finished session and summarise each drill. */
export const blindfoldRouter = {
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
      };
    });
  }),
};

function recentSessions(db: Database, userId: string, drill: DrillKind) {
  return db
    .select()
    .from(drillSession)
    .where(and(eq(drillSession.userId, userId), eq(drillSession.drill, drill)))
    .orderBy(desc(drillSession.createdAt))
    .limit(RECENT_SESSIONS);
}
