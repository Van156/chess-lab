import type { Database } from "@b2c-template/db";
import { cardPillar, cardPillarSql } from "@b2c-template/db/card-pillar";
import type { CardPillar } from "@b2c-template/db/card-pillar";
import { card, reviewLog } from "@b2c-template/db/schema/cards";
import { game, mistake } from "@b2c-template/db/schema/games";
import {
  CARD_STATE,
  LEARNING_CARD_STATES,
  clampReviewedAt,
  grade,
  localDayBounds,
  selectQueue,
} from "@b2c-template/study";
import type { CardState, Grade, QueueCandidate } from "@b2c-template/study";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";

import { getSettings } from "./settings-service";

/** Pillars shipped in v1; the flags object arrives in S7 and replaces this default. */
export const DEFAULT_ENABLED_PILLARS: CardPillar[] = ["mistakes"];

export type QueueItem = {
  cardId: string;
  pillar: CardPillar;
  state: 0 | 1 | 2 | 3;
  due: Date;
  /** The position before the mistake and the side the user played. */
  prompt: { fen: string; orientation: "white" | "black" };
  /** Accepted answers; the engine best move for a mistake card. */
  answers: { san: string; uci: string }[];
  context: { playedSan: string; gameId: string; evalLossCp: number; ply: number };
};

export type GradeInput = {
  reviewLogId: string;
  cardId: string;
  grade: Grade;
  reviewedAt: Date;
  elapsedMs: number;
};

/** The card state returned to the client after a grade. */
export type GradeResult = { replayed: boolean; card: CardState };

type CardRow = typeof card.$inferSelect;

function toCardState(row: CardRow): CardState {
  return {
    due: row.due,
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsedDays: row.elapsedDays ?? 0,
    scheduledDays: row.scheduledDays ?? 0,
    learningSteps: row.learningSteps ?? 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    state: row.state as CardState["state"],
    lastReview: row.lastReview,
  };
}

/** Stored `state_before` / `state_after` are JSON; dates come back as ISO strings. */
function reviveState(json: unknown): CardState {
  const raw = json as Omit<CardState, "due" | "lastReview"> & {
    due: string;
    lastReview: string | null;
  };
  return {
    ...raw,
    due: new Date(raw.due),
    lastReview: raw.lastReview ? new Date(raw.lastReview) : null,
  };
}

/** Serializes through JSON so a fresh grade and a replay return exactly the same shape. */
function snapshot(state: CardState): CardState {
  return reviveState(JSON.parse(JSON.stringify(state)));
}

export type NewCardAllowance = {
  settings: Awaited<ReturnType<typeof getSettings>>;
  /** The user's local day: `[start, end)`. */
  start: Date;
  end: Date;
  introducedToday: number;
  /** New cards the user may still start today (never negative). */
  newBudget: number;
};

/**
 * The user's local day and how many new cards they may still start in it. Shared by the queue and
 * Today so both agree on the budget. Scoped to `userId`.
 */
export async function newCardAllowance(
  db: Database,
  userId: string,
  current: Date,
): Promise<NewCardAllowance> {
  const settings = await getSettings(db, userId);
  const { start, end } = localDayBounds(current, settings.timeZone);
  const [introduced] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviewLog)
    .where(
      and(
        eq(reviewLog.userId, userId),
        gte(reviewLog.reviewedAt, start),
        lt(reviewLog.reviewedAt, end),
        sql`(${reviewLog.stateBefore}->>'state')::int = ${CARD_STATE.New}`,
      ),
    );
  const introducedToday = introduced?.n ?? 0;
  return {
    settings,
    start,
    end,
    introducedToday,
    newBudget: Math.max(0, settings.dailyNewCardLimit - introducedToday),
  };
}

export type ReviewServiceDeps = { db: Database; now?: () => Date };

/** Review queue and idempotent grading (ADR-13). Every query filters by the session user id. */
export function createReviewService({ db, now = () => new Date() }: ReviewServiceDeps) {
  async function getQueue(
    userId: string,
    opts: { limit: number; enabledPillars?: CardPillar[] },
  ): Promise<QueueItem[]> {
    const enabled = opts.enabledPillars ?? DEFAULT_ENABLED_PILLARS;
    if (enabled.length === 0 || opts.limit <= 0) return [];

    const current = now();
    const { settings, end, introducedToday, newBudget } = await newCardAllowance(
      db,
      userId,
      current,
    );

    const columns = {
      cardId: card.id,
      pillar: cardPillarSql,
      state: card.state,
      due: card.due,
    };
    const scope = and(eq(card.userId, userId), inArray(cardPillarSql, enabled));
    // Bound the backlog. `selectQueue` leads with learning/relearning cards already due (oldest
    // first), then round-robins the rest across pillars, and cuts to `limit`. Both groups are
    // prefixes of their due order, so keeping the first `limit` cards per (pillar, group) is enough.
    const learningNow = sql`(${card.state} in (${sql.join(
      LEARNING_CARD_STATES.map((state) => sql`${state}`),
      sql`, `,
    )}) and ${card.due} <= ${current})`;
    const rankedDue = db
      .select({
        ...columns,
        pillar: sql<CardPillar>`${cardPillarSql}`.as("pillar"),
        rank: sql<number>`row_number() over (partition by ${cardPillarSql}, ${learningNow} order by ${card.due}, ${card.id})`.as(
          "rank",
        ),
      })
      .from(card)
      .where(and(scope, ne(card.state, CARD_STATE.New), lt(card.due, end)))
      .as("ranked_due");
    const dueRows = await db
      .select({
        cardId: rankedDue.cardId,
        pillar: rankedDue.pillar,
        state: rankedDue.state,
        due: rankedDue.due,
      })
      .from(rankedDue)
      .where(lte(rankedDue.rank, opts.limit));
    const freshRows =
      newBudget === 0
        ? []
        : await db
            .select(columns)
            .from(card)
            .where(and(scope, eq(card.state, CARD_STATE.New)))
            .orderBy(asc(card.createdAt), asc(card.id))
            .limit(newBudget);

    const asCandidate = (r: (typeof dueRows)[number]): QueueCandidate => ({
      cardId: r.cardId,
      pillar: r.pillar,
      state: r.state as QueueCandidate["state"],
      due: r.due,
    });
    const selected = selectQueue({
      due: dueRows.map(asCandidate),
      fresh: freshRows.map(asCandidate),
      introducedToday,
      dailyNewLimit: settings.dailyNewCardLimit,
      now: current,
      limit: opts.limit,
    });
    return hydrate(userId, selected);
  }

  async function hydrate(userId: string, selected: QueueCandidate[]): Promise<QueueItem[]> {
    if (selected.length === 0) return [];
    const rows = await db
      .select({
        cardId: card.id,
        mistakeId: card.mistakeId,
        fen: mistake.fenBefore,
        color: game.userColor,
        bestSan: mistake.bestSan,
        bestUci: mistake.bestUci,
        playedSan: mistake.playedSan,
        gameId: mistake.gameId,
        evalLossCp: mistake.evalLossCp,
        ply: mistake.ply,
      })
      .from(card)
      .innerJoin(mistake, and(eq(mistake.id, card.mistakeId), eq(mistake.userId, userId)))
      .innerJoin(game, and(eq(game.id, mistake.gameId), eq(game.userId, userId)))
      .where(
        and(
          eq(card.userId, userId),
          inArray(
            card.id,
            selected.map((c) => c.cardId),
          ),
        ),
      );
    const byCard = new Map(rows.map((r) => [r.cardId, r]));
    return selected.flatMap((c): QueueItem[] => {
      const r = byCard.get(c.cardId);
      if (!r) return [];
      return [
        {
          cardId: c.cardId,
          pillar: cardPillar(r),
          state: c.state,
          due: c.due,
          prompt: { fen: r.fen, orientation: r.color },
          answers: [{ san: r.bestSan, uci: r.bestUci }],
          context: {
            playedSan: r.playedSan,
            gameId: r.gameId,
            evalLossCp: r.evalLossCp,
            ply: r.ply,
          },
        },
      ];
    });
  }

  async function gradeCard(userId: string, input: GradeInput): Promise<GradeResult> {
    return db.transaction(async (tx) => {
      // The row lock serializes grades of one card, so each one sees the previous result.
      const [row] = await tx
        .select()
        .from(card)
        .where(and(eq(card.id, input.cardId), eq(card.userId, userId)))
        .for("update");
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Card not found." });

      const replayOf = async (): Promise<GradeResult | null> => {
        const [existing] = await tx
          .select({ stateAfter: reviewLog.stateAfter })
          .from(reviewLog)
          .where(
            and(
              eq(reviewLog.id, input.reviewLogId),
              eq(reviewLog.userId, userId),
              eq(reviewLog.cardId, input.cardId),
            ),
          );
        return existing ? { replayed: true, card: reviveState(existing.stateAfter) } : null;
      };

      const replay = await replayOf();
      if (replay) return replay;

      const before = toCardState(row);
      const reviewedAt = clampReviewedAt(input.reviewedAt, before.lastReview, now());
      const { next } = grade(before, input.grade, reviewedAt);

      const inserted = await tx
        .insert(reviewLog)
        .values({
          id: input.reviewLogId,
          userId,
          cardId: input.cardId,
          grade: input.grade,
          reviewedAt,
          elapsedMs: input.elapsedMs,
          stateBefore: snapshot(before),
          stateAfter: snapshot(next),
        })
        .onConflictDoNothing()
        .returning({ id: reviewLog.id });
      if (inserted.length === 0) {
        // The id exists but is not this user's log for this card: never reveal or reuse it.
        throw new ORPCError("CONFLICT", { message: "Review id already used." });
      }

      await tx
        .update(card)
        .set({
          due: next.due,
          stability: next.stability,
          difficulty: next.difficulty,
          elapsedDays: next.elapsedDays,
          scheduledDays: next.scheduledDays,
          learningSteps: next.learningSteps,
          reps: next.reps,
          lapses: next.lapses,
          state: next.state,
          lastReview: next.lastReview,
        })
        .where(and(eq(card.id, input.cardId), eq(card.userId, userId)));
      return { replayed: false, card: snapshot(next) };
    });
  }

  return { getQueue, gradeCard };
}

export type ReviewService = ReturnType<typeof createReviewService>;
