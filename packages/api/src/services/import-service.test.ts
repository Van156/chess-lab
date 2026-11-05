import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { game, gameAnalysis } from "@b2c-template/db/schema/games";
import { lichessProfile } from "@b2c-template/db/schema/lichess";
import { user } from "@b2c-template/db/schema/auth";
import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import type { LichessGame } from "@b2c-template/lichess";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  FIRST_IMPORT_MAX_GAMES,
  IMPORT_LEASE_MS,
  IMPORT_LOOKBACK_MS,
  IMPORT_WINDOW_MONTHS,
} from "./import-config";
import { createImportService, shouldAutoSync } from "./import-service";
import type { GamesSource } from "./import-service";

/**
 * Integration tests for the import service (ADR-10) against the real test database, with a fake
 * `GamesSource` standing in for Lichess. Skips locally (fails loudly in CI) without a test DB.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "import service");

const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function lichessGame(index: number, overrides: Partial<LichessGame> = {}): LichessGame {
  const id = `g${String(index).padStart(7, "0")}`;
  return {
    id,
    rated: true,
    variant: "standard",
    speed: "blitz",
    status: "mate",
    createdAt: NOW - 30 * DAY + index * 60_000,
    winner: "white",
    players: {
      white: { user: { id: "alice", name: "Alice" }, rating: 1500 },
      black: { user: { id: "bob", name: "Bob" }, rating: 1480 },
    },
    opening: { eco: "C20", name: "King's Pawn Game" },
    clock: { initial: 300, increment: 3 },
    pgn: [
      `[Event "Rated blitz game"]`,
      `[Site "https://lichess.org/${id}"]`,
      `[White "Alice"]`,
      `[Black "Bob"]`,
      `[Result "1-0"]`,
      `[TimeControl "300+3"]`,
      `[ECO "C20"]`,
      `[Opening "King's Pawn Game"]`,
      ``,
      `1. e4 { [%clk 0:05:00] } 1... e5 { [%clk 0:05:00] } 1-0`,
    ].join("\n"),
    ...overrides,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

type FakeSource = GamesSource & { calls: Parameters<GamesSource["exportGames"]>[0][] };

/** Yields `games`; throws `failWith` after `failAfter` games were delivered. */
function fakeSource(
  games: LichessGame[],
  opts: { failAfter?: number; failWith?: Error } = {},
): FakeSource {
  const calls: FakeSource["calls"] = [];
  return {
    calls,
    async *exportGames(args) {
      calls.push(args);
      let delivered = 0;
      for (const item of games) {
        if (item.createdAt < args.sinceMs) continue;
        if (opts.failAfter !== undefined && delivered === opts.failAfter) {
          throw opts.failWith ?? new Error("boom");
        }
        delivered += 1;
        yield item;
      }
    },
  };
}

describe.skipIf(!reachable)("import service", () => {
  let handle: TestDatabaseHandle;
  const signal = new AbortController().signal;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    await handle.db.insert(user).values({ id: "u1", name: "Alice", email: "alice@example.test" });
    await handle.db
      .insert(lichessProfile)
      .values({ userId: "u1", lichessId: "alice", username: "Alice" });
  });

  function service(source: GamesSource, now = NOW, batchSize = 2) {
    return createImportService({ db: handle.db, source, now: () => now, batchSize });
  }

  async function profile() {
    const [row] = await handle.db
      .select()
      .from(lichessProfile)
      .where(eq(lichessProfile.userId, "u1"));
    return row!;
  }

  async function gameCount() {
    return (await handle.db.select().from(game)).length;
  }

  test("first import uses the configured window and stores games with analysis rows", async () => {
    const source = fakeSource([lichessGame(1), lichessGame(2)]);
    const status = await service(source).requestSync("u1", signal);

    const windowStart = new Date(NOW);
    windowStart.setUTCMonth(windowStart.getUTCMonth() - IMPORT_WINDOW_MONTHS);
    expect(source.calls[0]?.sinceMs).toBe(windowStart.getTime());
    expect(source.calls[0]?.max).toBe(FIRST_IMPORT_MAX_GAMES);
    expect(source.calls[0]?.username).toBe("Alice");
    expect(source.calls[0]?.userId).toBe("u1");

    expect(status).toMatchObject({ state: "idle", gamesImported: 2 });
    const rows = await handle.db.select().from(game);
    expect(rows[0]).toMatchObject({
      userId: "u1",
      userColor: "white",
      speed: "blitz",
      timeControlInitialS: 300,
      timeControlIncrementS: 3,
      rated: true,
      result: "1-0",
      eco: "C20",
      openingName: "King's Pawn Game",
    });
    const analysis = await handle.db.select().from(gameAnalysis);
    expect(analysis).toHaveLength(2);
    expect(analysis.every((row) => row.status === "pending" && row.userId === "u1")).toBe(true);
  });

  test("a game played as black is stored with the black user colour", async () => {
    const asBlack = lichessGame(1, {
      players: {
        white: { user: { id: "bob", name: "Bob" } },
        black: { user: { id: "alice", name: "Alice" } },
      },
      winner: "black",
      pgn: lichessGame(1)
        .pgn.replace('[White "Alice"]', '[White "Bob"]')
        .replace('[Black "Bob"]', '[Black "Alice"]')
        .replaceAll("1-0", "0-1"),
    });
    await service(fakeSource([asBlack])).requestSync("u1", signal);
    const [row] = await handle.db.select().from(game);
    expect(row).toMatchObject({ userColor: "black", result: "0-1" });
  });

  test("end of stream sets idle, first_import_done_at and last_synced_at", async () => {
    await service(fakeSource([lichessGame(1)])).requestSync("u1", signal);
    const row = await profile();
    expect(row.importState).toBe("idle");
    expect(row.lastSyncedAt?.getTime()).toBe(NOW);
    expect(row.firstImportDoneAt?.getTime()).toBe(NOW);
    expect(row.importLeaseUntil).toBeNull();
    expect(row.importError).toBeNull();
  });

  test("a user with no games completes with zero games", async () => {
    const status = await service(fakeSource([])).requestSync("u1", signal);
    expect(status).toMatchObject({ state: "idle", gamesImported: 0 });
    expect((await profile()).firstImportDoneAt).not.toBeNull();
  });

  test("resume after a mid-stream failure adds no duplicates and continues from the cursor", async () => {
    const games = [1, 2, 3, 4, 5].map((n) => lichessGame(n));
    const failing = fakeSource(games, { failAfter: 3 });
    const failed = await service(failing).requestSync("u1", signal);
    expect(failed.state).toBe("failed");
    // Batch size 2: the first batch (games 1, 2) is committed, game 3 was still buffered.
    expect(await gameCount()).toBe(2);
    const afterFailure = await profile();
    expect(afterFailure.importCursorMs).toBe(games[1]!.createdAt + 1);
    expect(afterFailure.importLeaseUntil).toBeNull();

    const resumed = fakeSource(games);
    const status = await service(resumed).requestSync("u1", signal);
    expect(resumed.calls[0]?.sinceMs).toBe(games[1]!.createdAt + 1);
    expect(status).toMatchObject({ state: "idle", gamesImported: 5 });
    expect(await gameCount()).toBe(5);
    const ids = (await handle.db.select().from(game)).map((row) => row.lichessGameId);
    expect(new Set(ids).size).toBe(5);
  });

  test("a replayed game id is a no-op", async () => {
    await service(fakeSource([lichessGame(1)])).requestSync("u1", signal);
    await handle.db
      .update(lichessProfile)
      .set({ importCursorMs: null })
      .where(eq(lichessProfile.userId, "u1"));
    await service(fakeSource([lichessGame(1)])).requestSync("u1", signal);
    expect(await gameCount()).toBe(1);
    expect(await handle.db.select().from(gameAnalysis)).toHaveLength(1);
  });

  test("an incremental sync only asks for games after the cursor", async () => {
    await service(fakeSource([lichessGame(1)])).requestSync("u1", signal);
    const second = fakeSource([lichessGame(1), lichessGame(2)]);
    const status = await service(second, NOW + DAY).requestSync("u1", signal);
    expect(second.calls[0]?.sinceMs).toBe(lichessGame(1).createdAt + 1 - IMPORT_LOOKBACK_MS);
    expect(second.calls[0]?.max).toBeUndefined();
    expect(status.gamesImported).toBe(2);
    expect((await profile()).lastSyncedAt?.getTime()).toBe(NOW + DAY);
  });

  test("an incremental sync re-fetches the lookback window without duplicates or resetting analysis", async () => {
    await service(fakeSource([lichessGame(1)])).requestSync("u1", signal);
    await handle.db.update(gameAnalysis).set({ status: "complete" });
    const cursorBefore = (await profile()).importCursorMs!;

    const second = fakeSource([lichessGame(1), lichessGame(2)]);
    await service(second, NOW + DAY).requestSync("u1", signal);

    expect(await gameCount()).toBe(2);
    const analysis = await handle.db.select().from(gameAnalysis);
    expect(analysis).toHaveLength(2);
    expect(analysis.filter((row) => row.status === "complete")).toHaveLength(1);
    expect((await profile()).importCursorMs).toBeGreaterThanOrEqual(cursorBefore);
  });

  test("the cursor never moves backwards when a lookback batch holds only old games", async () => {
    await service(fakeSource([lichessGame(1), lichessGame(2)])).requestSync("u1", signal);
    const cursorBefore = (await profile()).importCursorMs!;
    // Batch size 2: one batch of two already-known (old) games.
    await service(fakeSource([lichessGame(1), lichessGame(2)]), NOW + DAY).requestSync(
      "u1",
      signal,
    );
    expect((await profile()).importCursorMs).toBe(cursorBefore);
  });

  test("the first import applies no lookback", async () => {
    const source = fakeSource([]);
    await service(source).requestSync("u1", signal);
    const windowStart = new Date(NOW);
    windowStart.setUTCMonth(windowStart.getUTCMonth() - IMPORT_WINDOW_MONTHS);
    expect(source.calls[0]?.sinceMs).toBe(windowStart.getTime());
  });

  test("a non-ascending stream never moves the cursor below the newest game seen", async () => {
    // GamesSource contract: ascending createdAt. A violation must not regress the cursor.
    const newest = lichessGame(3);
    await service(fakeSource([lichessGame(1), newest, lichessGame(2)])).requestSync("u1", signal);
    expect(await gameCount()).toBe(3);
    expect((await profile()).importCursorMs).toBe(newest.createdAt + 1);
  });

  test("a stale run whose lease was taken over cannot overwrite the newer run", async () => {
    const reached = deferred();
    const release = deferred();
    const staleSource: GamesSource = {
      async *exportGames() {
        yield lichessGame(1);
        yield lichessGame(2);
        reached.resolve();
        await release.promise;
        yield lichessGame(3);
        yield lichessGame(4);
      },
    };
    const a = await service(staleSource).startSync("u1", signal);
    await reached.promise;
    // Let A's first batch commit before B takes the expired lease.
    await Bun.sleep(50);
    expect(await gameCount()).toBe(2);

    const laterNow = NOW + IMPORT_LEASE_MS + 1;
    await service(fakeSource([lichessGame(1), lichessGame(2)]), laterNow).requestSync("u1", signal);
    const afterB = await profile();
    expect(afterB.importState).toBe("idle");
    expect(afterB.lastSyncedAt?.getTime()).toBe(laterNow);

    release.resolve();
    await a.done;

    expect(await gameCount()).toBe(2);
    const afterA = await profile();
    expect(afterA.importCursorMs).toBe(afterB.importCursorMs);
    expect(afterA.importState).toBe("idle");
    expect(afterA.lastSyncedAt?.getTime()).toBe(laterNow);
  });

  test("a stale run's failure does not overwrite the newer run's state", async () => {
    const reached = deferred();
    const release = deferred();
    const staleSource: GamesSource = {
      async *exportGames() {
        reached.resolve();
        await release.promise;
        yield* [];
        throw new Error("boom");
      },
    };
    const a = await service(staleSource).startSync("u1", signal);
    await reached.promise;
    const laterNow = NOW + IMPORT_LEASE_MS + 1;
    await service(fakeSource([]), laterNow).requestSync("u1", signal);
    release.resolve();
    await a.done;
    const row = await profile();
    expect(row.importState).toBe("idle");
    expect(row.importError).toBeNull();
  });

  test("a held lease blocks a concurrent run and returns the current status", async () => {
    await handle.db
      .update(lichessProfile)
      .set({ importState: "running", importLeaseUntil: new Date(NOW + IMPORT_LEASE_MS) })
      .where(eq(lichessProfile.userId, "u1"));
    const source = fakeSource([lichessGame(1)]);
    const status = await service(source).requestSync("u1", signal);
    expect(status.state).toBe("running");
    expect(source.calls).toHaveLength(0);
    expect(await gameCount()).toBe(0);
  });

  test("two simultaneous triggers run the source once", async () => {
    // The source stays open until both triggers have tried to take the lease, so "simultaneous"
    // holds regardless of scheduler speed (a trigger arriving after a finished run is a new sync).
    const gate = deferred();
    const inner = fakeSource([lichessGame(1), lichessGame(2)]);
    const source: FakeSource = {
      calls: inner.calls,
      async *exportGames(args) {
        await gate.promise;
        yield* inner.exportGames(args);
      },
    };
    const svc = service(source);
    const first = await svc.startSync("u1", signal);
    const second = await svc.startSync("u1", signal);
    gate.resolve();
    await Promise.all([first.done, second.done]);
    expect(source.calls).toHaveLength(1);
    expect(await gameCount()).toBe(2);
  });

  test("an expired lease can be taken over", async () => {
    await handle.db
      .update(lichessProfile)
      .set({ importState: "running", importLeaseUntil: new Date(NOW - 1) })
      .where(eq(lichessProfile.userId, "u1"));
    const status = await service(fakeSource([lichessGame(1)])).requestSync("u1", signal);
    expect(status).toMatchObject({ state: "idle", gamesImported: 1 });
  });

  test("a 429 sets backoff with import_retry_at and keeps committed games", async () => {
    const retryAt = NOW + 5 * 60_000;
    const limited = Object.assign(new Error("rate limited"), {
      name: "LichessRateLimited",
      retryAt,
    });
    const games = [1, 2, 3].map((n) => lichessGame(n));
    const status = await service(
      fakeSource(games, { failAfter: 2, failWith: limited }),
    ).requestSync("u1", signal);
    expect(status).toMatchObject({ state: "backoff", gamesImported: 2 });
    expect(status.retryAt?.getTime()).toBe(retryAt);
    const row = await profile();
    expect(row.importState).toBe("backoff");
    expect(row.importRetryAt?.getTime()).toBe(retryAt);
    expect(row.importLeaseUntil).toBeNull();
  });

  test("a sync is refused until import_retry_at has passed", async () => {
    await handle.db
      .update(lichessProfile)
      .set({ importState: "backoff", importRetryAt: new Date(NOW + 60_000) })
      .where(eq(lichessProfile.userId, "u1"));
    const source = fakeSource([lichessGame(1)]);
    const status = await service(source).requestSync("u1", signal);
    expect(status.state).toBe("backoff");
    expect(source.calls).toHaveLength(0);

    const later = await service(source, NOW + 120_000).requestSync("u1", signal);
    expect(later.state).toBe("idle");
    expect(source.calls).toHaveLength(1);
  });

  test("other errors set failed with a safe message that hides the raw error", async () => {
    const secret = new Error("connect ECONNREFUSED 10.0.0.5:5432 token=abc123");
    const status = await service(
      fakeSource([lichessGame(1)], { failAfter: 0, failWith: secret }),
    ).requestSync("u1", signal);
    expect(status.state).toBe("failed");
    const row = await profile();
    expect(row.importState).toBe("failed");
    expect(row.importError).toBeTruthy();
    expect(row.importError).not.toContain("abc123");
    expect(row.importError).not.toContain("10.0.0.5");
  });

  test("a rejected token asks the user to sign in with Lichess again", async () => {
    const unauthorized = Object.assign(new Error("nope"), { name: "LichessUnauthorized" });
    await service(
      fakeSource([lichessGame(1)], { failAfter: 0, failWith: unauthorized }),
    ).requestSync("u1", signal);
    expect((await profile()).importError).toContain("Sign in with Lichess again");
  });

  test("the first import is capped at FIRST_IMPORT_MAX_GAMES even if the source overdelivers", async () => {
    const games = Array.from({ length: FIRST_IMPORT_MAX_GAMES + 5 }, (_, n) =>
      lichessGame(n + 1, { createdAt: NOW - 20 * DAY + n * 1000 }),
    );
    // A batch of 100 keeps this to ~10 transactions instead of 500, so the test measures the cap
    // and not database round-trip latency (which blew the 5s timeout on a loaded machine).
    const status = await service(fakeSource(games), NOW, 100).requestSync("u1", signal);
    expect(status.gamesImported).toBe(FIRST_IMPORT_MAX_GAMES);
  });

  test("an aborted import keeps committed games and leaves the lease to expire", async () => {
    const controller = new AbortController();
    const games = [1, 2, 3, 4].map((n) => lichessGame(n));
    const source: GamesSource = {
      async *exportGames() {
        for (const [index, item] of games.entries()) {
          if (index === 2) controller.abort();
          yield item;
        }
      },
    };
    const status = await service(source).requestSync("u1", controller.signal);
    expect(await gameCount()).toBe(2);
    const row = await profile();
    expect(row.importState).toBe("running");
    expect(row.importLeaseUntil).not.toBeNull();
    // An expired lease reads as idle: the import is resumable.
    expect(status.state).toBe("running");
    expect((await service(fakeSource([]), NOW + IMPORT_LEASE_MS + 1).status("u1")).state).toBe(
      "idle",
    );
  });

  test("status for a user without a Lichess profile is idle with no games", async () => {
    await handle.db.insert(user).values({ id: "u2", name: "Mail", email: "mail@example.test" });
    const source = fakeSource([lichessGame(1)]);
    const svc = service(source);
    expect(await svc.status("u2")).toEqual({
      state: "idle",
      lastSyncedAt: null,
      retryAt: null,
      gamesImported: 0,
    });
    expect((await svc.requestSync("u2", signal)).state).toBe("idle");
    expect(source.calls).toHaveLength(0);
  });
});

describe("shouldAutoSync", () => {
  const idle = { state: "idle", lastSyncedAt: null, retryAt: null, gamesImported: 0 } as const;

  test("syncs when never synced or older than the threshold", () => {
    expect(shouldAutoSync(idle, NOW)).toBe(true);
    expect(shouldAutoSync({ ...idle, lastSyncedAt: new Date(NOW - 7 * 60 * 60 * 1000) }, NOW)).toBe(
      true,
    );
  });

  test("does not sync when fresh, running, failed or still backing off", () => {
    expect(shouldAutoSync({ ...idle, lastSyncedAt: new Date(NOW - 60_000) }, NOW)).toBe(false);
    expect(shouldAutoSync({ ...idle, state: "running" }, NOW)).toBe(false);
    expect(shouldAutoSync({ ...idle, state: "failed" }, NOW)).toBe(false);
    expect(shouldAutoSync({ ...idle, state: "backoff", retryAt: new Date(NOW + 1000) }, NOW)).toBe(
      false,
    );
  });

  test("syncs again once the backoff has elapsed", () => {
    expect(shouldAutoSync({ ...idle, state: "backoff", retryAt: new Date(NOW - 1) }, NOW)).toBe(
      true,
    );
  });
});
