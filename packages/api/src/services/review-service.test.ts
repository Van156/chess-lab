import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { card, reviewLog } from "@b2c-template/db/schema/cards";
import { game, mistake } from "@b2c-template/db/schema/games";
import { userSettings } from "@b2c-template/db/schema/settings";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { grade as applyGrade, newCardState } from "@b2c-template/study";
import type { CardState } from "@b2c-template/study";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createReviewService } from "./review-service";

/**
 * Integration tests for the review service (ADR-13) against the real test database. Skips locally
 * (fails loudly in CI) without a test DB.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "review service");

const NOW = new Date(Date.UTC(2026, 9, 4, 12, 0, 0));
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe.skipIf(!reachable)("review service", () => {
  let handle: TestDatabaseHandle;
  let seq = 0;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    seq = 0;
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: id, email: `${id}@example.test` });
    }
  });

  const service = (now = NOW) => createReviewService({ db: handle.db, now: () => now });

  /** Inserts a game, a mistake and its card for `userId`; returns the card id. */
  async function seedCard(
    userId: string,
    opts: { state?: CardState; fen?: string; color?: "white" | "black"; createdAt?: Date } = {},
  ) {
    seq += 1;
    const [g] = await handle.db
      .insert(game)
      .values({
        userId,
        lichessGameId: `${userId}-g${seq}`,
        pgn: "1. e4 e5 *",
        userColor: opts.color ?? "white",
        speed: "blitz",
        rated: true,
        result: "*",
        playedAt: NOW,
      })
      .returning();
    const [m] = await handle.db
      .insert(mistake)
      .values({
        userId,
        gameId: g!.id,
        ply: seq,
        fenBefore: opts.fen ?? START_FEN,
        positionKey: `key${seq}`,
        playedSan: "a3",
        playedUci: "a2a3",
        bestSan: "e4",
        bestUci: "e2e4",
        evalBeforeCp: 30,
        evalAfterCp: -120,
        evalLossCp: 150,
        severity: "mistake",
        phase: "opening",
      })
      .returning();
    const state = opts.state ?? newCardState(NOW);
    const [c] = await handle.db
      .insert(card)
      .values({
        userId,
        mistakeId: m!.id,
        due: state.due,
        stability: state.stability,
        difficulty: state.difficulty,
        elapsedDays: state.elapsedDays,
        scheduledDays: state.scheduledDays,
        learningSteps: state.learningSteps,
        reps: state.reps,
        lapses: state.lapses,
        state: state.state,
        lastReview: state.lastReview,
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      })
      .returning();
    return { cardId: c!.id, gameId: g!.id, mistakeId: m!.id };
  }

  /** A card state that was reviewed once, due at `due`. */
  function reviewed(due: Date, lastReview: Date): CardState {
    const first = applyGrade(newCardState(lastReview), 3, lastReview, {
      desiredRetention: 0.9,
      maximumInterval: 365,
      enableFuzz: false,
    }).next;
    return { ...first, state: 2, due, lastReview };
  }

  const input = (cardId: string, over: Record<string, unknown> = {}) => ({
    reviewLogId: crypto.randomUUID(),
    cardId,
    grade: 3 as const,
    reviewedAt: NOW,
    elapsedMs: 4200,
    ...over,
  });

  describe("gradeCard", () => {
    test("grades a new card Good: updates the card and stores one log with elapsedMs", async () => {
      const { cardId } = await seedCard("u1");
      const req = input(cardId);
      const result = await service().gradeCard("u1", req);

      expect(result.replayed).toBe(false);
      expect(result.card.reps).toBe(1);
      expect(result.card.due.getTime()).toBeGreaterThan(NOW.getTime());

      const [row] = await handle.db.select().from(card).where(eq(card.id, cardId));
      expect(row).toMatchObject({ reps: 1, lastReview: NOW });
      const logs = await handle.db.select().from(reviewLog);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: req.reviewLogId,
        userId: "u1",
        cardId,
        grade: 3,
        elapsedMs: 4200,
      });
      expect((logs[0]!.stateBefore as { state: number }).state).toBe(0);
      expect((logs[0]!.stateAfter as { reps: number }).reps).toBe(1);
    });

    test("replaying the same reviewLogId returns the stored state and does not double-apply", async () => {
      const { cardId } = await seedCard("u1");
      const req = input(cardId);
      const first = await service().gradeCard("u1", req);
      const replay = await service(new Date(NOW.getTime() + HOUR)).gradeCard("u1", req);

      expect(replay.replayed).toBe(true);
      expect(replay.card).toEqual(first.card);
      expect(await handle.db.select().from(reviewLog)).toHaveLength(1);
      const [row] = await handle.db.select().from(card).where(eq(card.id, cardId));
      expect(row!.reps).toBe(1);
    });

    test("concurrent grades of the same card are serialized (FOR UPDATE)", async () => {
      const { cardId } = await seedCard("u1");
      const svc = service();
      const results = await Promise.all(
        Array.from({ length: 4 }, () => svc.gradeCard("u1", input(cardId))),
      );
      expect(results.every((r) => !r.replayed)).toBe(true);
      const [row] = await handle.db.select().from(card).where(eq(card.id, cardId));
      expect(row!.reps).toBe(4);
      expect(await handle.db.select().from(reviewLog)).toHaveLength(4);
    });

    test("concurrent replays of the same reviewLogId apply once", async () => {
      const { cardId } = await seedCard("u1");
      const req = input(cardId);
      const svc = service();
      const results = await Promise.all([svc.gradeCard("u1", req), svc.gradeCard("u1", req)]);
      expect(results.filter((r) => r.replayed)).toHaveLength(1);
      expect(await handle.db.select().from(reviewLog)).toHaveLength(1);
      const [row] = await handle.db.select().from(card).where(eq(card.id, cardId));
      expect(row!.reps).toBe(1);
    });

    test("clamps a client time in the far future to now + 5 minutes", async () => {
      const { cardId } = await seedCard("u1");
      await service().gradeCard("u1", input(cardId, { reviewedAt: new Date(NOW.getTime() + DAY) }));
      const [row] = await handle.db.select().from(card).where(eq(card.id, cardId));
      expect(row!.lastReview!.getTime()).toBe(NOW.getTime() + 5 * 60 * 1000);
      const [log] = await handle.db.select().from(reviewLog);
      expect(log!.reviewedAt.getTime()).toBe(NOW.getTime() + 5 * 60 * 1000);
    });

    test("clamps a client time before the last review up to the last review", async () => {
      const last = new Date(NOW.getTime() - DAY);
      const { cardId } = await seedCard("u1", {
        state: reviewed(new Date(NOW.getTime() - HOUR), last),
      });
      await service().gradeCard(
        "u1",
        input(cardId, { reviewedAt: new Date(last.getTime() - 3 * DAY) }),
      );
      const [row] = await handle.db.select().from(card).where(eq(card.id, cardId));
      expect(row!.lastReview!.getTime()).toBe(last.getTime());
    });

    test("grading another user's card is NOT_FOUND and changes nothing", async () => {
      const { cardId } = await seedCard("u2");
      await expect(service().gradeCard("u1", input(cardId))).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(await handle.db.select().from(reviewLog)).toHaveLength(0);
      const [row] = await handle.db.select().from(card).where(eq(card.id, cardId));
      expect(row!.reps).toBe(0);
    });

    test("an unknown card is NOT_FOUND", async () => {
      await expect(service().gradeCard("u1", input("nope"))).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    test("a reviewLogId already used by another user is rejected without leaking its state", async () => {
      const mine = await seedCard("u1");
      const theirs = await seedCard("u2");
      const req = input(theirs.cardId);
      await service().gradeCard("u2", req);
      await expect(
        service().gradeCard("u1", { ...input(mine.cardId), reviewLogId: req.reviewLogId }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const [row] = await handle.db.select().from(card).where(eq(card.id, mine.cardId));
      expect(row!.reps).toBe(0);
    });

    test("Again on a review card increases lapses", async () => {
      const last = new Date(NOW.getTime() - 5 * DAY);
      const { cardId } = await seedCard("u1", {
        state: reviewed(new Date(NOW.getTime() - HOUR), last),
      });
      const result = await service().gradeCard("u1", input(cardId, { grade: 1 }));
      expect(result.card.lapses).toBe(1);
    });
  });

  describe("getQueue", () => {
    const dueCard = (dueAt: Date) => reviewed(dueAt, new Date(dueAt.getTime() - 3 * DAY));

    test("hydrates the prompt, orientation, answers and context", async () => {
      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
      const seeded = await seedCard("u1", {
        state: dueCard(new Date(NOW.getTime() - HOUR)),
        fen,
        color: "black",
      });
      const queue = await service().getQueue("u1", { limit: 50 });
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        cardId: seeded.cardId,
        pillar: "mistakes",
        state: 2,
        prompt: { fen, orientation: "black" },
        answers: [{ san: "e4", uci: "e2e4" }],
        context: { playedSan: "a3", gameId: seeded.gameId, evalLossCp: 150 },
      });
    });

    test("includes overdue and due-today cards, excludes cards due tomorrow", async () => {
      const overdue = await seedCard("u1", { state: dueCard(new Date(NOW.getTime() - 2 * DAY)) });
      const later = await seedCard("u1", { state: dueCard(new Date(NOW.getTime() + HOUR)) });
      await seedCard("u1", { state: dueCard(new Date(NOW.getTime() + 2 * DAY)) });
      const ids = (await service().getQueue("u1", { limit: 50 })).map((i) => i.cardId);
      expect(new Set(ids)).toEqual(new Set([overdue.cardId, later.cardId]));
    });

    test("caps new cards at the daily limit and does not cap due cards", async () => {
      await handle.db.insert(userSettings).values({ userId: "u1", dailyNewCardLimit: 2 });
      for (let i = 0; i < 4; i++) await seedCard("u1");
      for (let i = 0; i < 3; i++) {
        await seedCard("u1", { state: dueCard(new Date(NOW.getTime() - HOUR)) });
      }
      const queue = await service().getQueue("u1", { limit: 50 });
      expect(queue.filter((i) => i.state === 0)).toHaveLength(2);
      expect(queue.filter((i) => i.state !== 0)).toHaveLength(3);
    });

    test("counts introduced-today from review logs whose state_before.state is 0", async () => {
      await handle.db.insert(userSettings).values({ userId: "u1", dailyNewCardLimit: 2 });
      const a = await seedCard("u1");
      const b = await seedCard("u1");
      for (let i = 0; i < 3; i++) await seedCard("u1");
      await service().gradeCard("u1", input(a.cardId));
      let queue = await service().getQueue("u1", { limit: 50 });
      expect(queue.filter((i) => i.state === 0)).toHaveLength(1);
      await service().gradeCard("u1", input(b.cardId));
      queue = await service().getQueue("u1", { limit: 50 });
      expect(queue.filter((i) => i.state === 0)).toHaveLength(0);
    });

    test("regrading an already introduced card does not consume the new-card budget", async () => {
      await handle.db.insert(userSettings).values({ userId: "u1", dailyNewCardLimit: 1 });
      await seedCard("u1");
      const reviewedCard = await seedCard("u1", {
        state: dueCard(new Date(NOW.getTime() - HOUR)),
      });
      await service().gradeCard("u1", input(reviewedCard.cardId));
      const queue = await service().getQueue("u1", { limit: 50 });
      expect(queue.filter((i) => i.state === 0)).toHaveLength(1);
    });

    test("a changed limit applies on the next build", async () => {
      await handle.db.insert(userSettings).values({ userId: "u1", dailyNewCardLimit: 1 });
      for (let i = 0; i < 3; i++) await seedCard("u1");
      expect(await service().getQueue("u1", { limit: 50 })).toHaveLength(1);
      await handle.db.update(userSettings).set({ dailyNewCardLimit: 3 });
      expect(await service().getQueue("u1", { limit: 50 })).toHaveLength(3);
    });

    test("uses the user's time zone for the local day", async () => {
      // NOW (2026-10-04 12:00Z) is already Oct 5 in Auckland (UTC+13). A log at 22:00Z on the 3rd
      // is Oct 4 there (yesterday), so it must not count against today's budget.
      await handle.db
        .insert(userSettings)
        .values({ userId: "u1", dailyNewCardLimit: 1, timeZone: "Pacific/Auckland" });
      const a = await seedCard("u1");
      await seedCard("u1");
      const yesterdayLocal = new Date(Date.UTC(2026, 9, 3, 22, 0, 0));
      await service(yesterdayLocal).gradeCard(
        "u1",
        input(a.cardId, { reviewedAt: yesterdayLocal }),
      );
      const queue = await service().getQueue("u1", { limit: 50 });
      expect(queue.filter((i) => i.state === 0)).toHaveLength(1);

      // In UTC the same log and a "now" of 23:00Z on the 3rd share a local day, so it counts.
      await handle.db.update(userSettings).set({ timeZone: "UTC" });
      const utcQueue = await service(new Date(Date.UTC(2026, 9, 3, 23, 0, 0))).getQueue("u1", {
        limit: 50,
      });
      expect(utcQueue.filter((i) => i.state === 0)).toHaveLength(0);
    });

    test("only the session user's cards appear", async () => {
      await seedCard("u2");
      const mine = await seedCard("u1");
      const ids = (await service().getQueue("u1", { limit: 50 })).map((i) => i.cardId);
      expect(ids).toEqual([mine.cardId]);
    });

    test("excludes pillars that are not enabled", async () => {
      await seedCard("u1");
      expect(await service().getQueue("u1", { limit: 50, enabledPillars: [] })).toEqual([]);
      expect(
        await service().getQueue("u1", { limit: 50, enabledPillars: ["mistakes"] }),
      ).toHaveLength(1);
    });

    test("with more due cards than the limit, the queue still starts with the right cards", async () => {
      // 8 review cards (day -8 .. -1), plus 2 learning cards due an hour ago (more recent than all
      // of them): learning cards lead, then the oldest review cards by due date.
      const reviewIds: string[] = [];
      for (let d = 8; d >= 1; d--) {
        const { cardId } = await seedCard("u1", {
          state: dueCard(new Date(NOW.getTime() - d * DAY)),
        });
        reviewIds.push(cardId);
      }
      const learningIds: string[] = [];
      for (const minutes of [90, 30]) {
        const { cardId } = await seedCard("u1", {
          state: {
            ...dueCard(new Date(NOW.getTime() - minutes * 60 * 1000)),
            state: 1,
          },
        });
        learningIds.push(cardId);
      }
      const ids = (await service().getQueue("u1", { limit: 5 })).map((i) => i.cardId);
      expect(ids).toEqual([...learningIds, ...reviewIds.slice(0, 3)]);
    });

    test("respects the limit and defaults the settings lazily", async () => {
      for (let i = 0; i < 3; i++) await seedCard("u1");
      expect(await service().getQueue("u1", { limit: 2 })).toHaveLength(2);
      expect(await handle.db.select().from(userSettings)).toHaveLength(1);
    });
  });
});
