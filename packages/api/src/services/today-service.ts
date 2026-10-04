import type { Database } from "@b2c-template/db";
import { cardPillarSql } from "@b2c-template/db/card-pillar";
import type { CardPillar } from "@b2c-template/db/card-pillar";
import { CARD_STATE } from "@b2c-template/study";
import { card, reviewLog } from "@b2c-template/db/schema/cards";
import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";

import { newCardAllowance } from "./review-service";

/** How far back the streak looks; a streak longer than this is shown capped. */
const STREAK_LOOKBACK_DAYS = 400;
const DAY_MS = 86_400_000;

export type Streak = {
  /** Consecutive local days with at least one review, ending today or yesterday. */
  days: number;
  /** False means the streak is alive only through yesterday and can still be extended today. */
  reviewedToday: boolean;
};

export type TodayCounts = {
  /** Cards due by the end of the user's local day, per enabled pillar (new cards excluded). */
  due: Partial<Record<CardPillar, number>>;
  dueTotal: number;
  /** New cards the user may still start today. */
  newBudgetLeft: number;
  streak: Streak;
};

const previousDay = (key: string): string => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - DAY_MS).toISOString().slice(0, 10);
};

/**
 * Streak from the user's distinct review days (`YYYY-MM-DD`, local) and today's local day key.
 * A streak ending yesterday counts; a gap of a full day breaks it.
 */
export function computeStreak(reviewDays: readonly string[], today: string): Streak {
  const days = new Set(reviewDays);
  const reviewedToday = days.has(today);
  let cursor = reviewedToday ? today : previousDay(today);
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = previousDay(cursor);
  }
  return { days: count, reviewedToday };
}

/** Local calendar day of `at` in `timeZone` as `YYYY-MM-DD`. */
function localDayKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export type TodayServiceDeps = { db: Database; now?: () => Date };

/** Read-only numbers behind the Today home. Every query filters by the session user id. */
export function createTodayService({ db, now = () => new Date() }: TodayServiceDeps) {
  async function getCounts(
    userId: string,
    opts: { enabledPillars: CardPillar[] },
  ): Promise<TodayCounts> {
    const current = now();
    const { settings, end, newBudget } = await newCardAllowance(db, userId, current);

    const due: Partial<Record<CardPillar, number>> = {};
    for (const pillar of opts.enabledPillars) due[pillar] = 0;
    if (opts.enabledPillars.length > 0) {
      const rows = await db
        .select({ pillar: sql<CardPillar>`${cardPillarSql}`, n: sql<number>`count(*)::int` })
        .from(card)
        .where(
          and(
            eq(card.userId, userId),
            inArray(cardPillarSql, opts.enabledPillars),
            ne(card.state, CARD_STATE.New),
            lt(card.due, end),
          ),
        )
        .groupBy(cardPillarSql);
      for (const row of rows) due[row.pillar] = row.n;
    }
    const dueTotal = Object.values(due).reduce((sum, n) => sum + n, 0);

    const dayExpr = sql<string>`to_char(${reviewLog.reviewedAt} at time zone ${settings.timeZone}, 'YYYY-MM-DD')`;
    const dayRows = await db
      .selectDistinct({ day: dayExpr })
      .from(reviewLog)
      .where(
        and(
          eq(reviewLog.userId, userId),
          gte(reviewLog.reviewedAt, new Date(current.getTime() - STREAK_LOOKBACK_DAYS * DAY_MS)),
        ),
      );
    const streak = computeStreak(
      dayRows.map((row) => row.day),
      localDayKey(current, settings.timeZone),
    );

    return { due, dueTotal, newBudgetLeft: newBudget, streak };
  }

  return { getCounts };
}

export type TodayService = ReturnType<typeof createTodayService>;
