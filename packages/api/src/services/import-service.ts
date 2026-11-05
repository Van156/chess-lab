import { parseGame } from "@b2c-template/chess";
import type { Database } from "@b2c-template/db";
import { game, gameAnalysis } from "@b2c-template/db/schema/games";
import { lichessProfile } from "@b2c-template/db/schema/lichess";
import type { ExportGamesArgs, LichessGame } from "@b2c-template/lichess";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import type { ImportStatus } from "../context";
import {
  AUTO_SYNC_AFTER_MS,
  FIRST_IMPORT_MAX_GAMES,
  IMPORT_BATCH_SIZE,
  IMPORT_LEASE_MS,
  IMPORT_LOOKBACK_MS,
  IMPORT_WINDOW_MONTHS,
} from "./import-config";

/**
 * Where games come from. The server adapter resolves the user's token behind this port, so the
 * service never sees it and `packages/api` has no Lichess runtime import (type-only below).
 *
 * Ordering contract: games MUST be yielded in ascending `createdAt` (the Lichess client sends
 * `sort=dateAsc`). The cursor commits `max(createdAt) + 1` per batch, so resuming after a failure
 * is only correct for an ascending stream. Correspondence games are excluded by the source.
 */
export type GamesSource = {
  exportGames(
    args: Omit<ExportGamesArgs, "token"> & { userId: string },
  ): AsyncIterable<LichessGame>;
};

export type ImportServiceDeps = {
  db: Database;
  source: GamesSource;
  now?: () => number;
  batchSize?: number;
};

type GameInsert = typeof game.$inferInsert;
type Profile = typeof lichessProfile.$inferSelect;

const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);

const MESSAGE_UNAUTHORIZED = "Lichess no longer accepts your sign-in. Sign in with Lichess again.";
const MESSAGE_GENERIC = "The Lichess import failed. Try again in a few minutes.";

/** The status route should enqueue a sync: idle and stale, or a backoff that has elapsed. */
export function shouldAutoSync(status: ImportStatus, nowMs: number): boolean {
  switch (status.state) {
    case "running":
    case "failed": {
      // Failed needs a manual retry: an auto retry would hammer Lichess with a rejected token.
      return false;
    }
    case "backoff": {
      return status.retryAt === null || status.retryAt.getTime() <= nowMs;
    }
    case "idle": {
      return (
        status.lastSyncedAt === null || nowMs - status.lastSyncedAt.getTime() > AUTO_SYNC_AFTER_MS
      );
    }
  }
}

/** First import: `IMPORT_WINDOW_MONTHS` back from now (calendar months, UTC). */
function windowStartMs(nowMs: number): number {
  const start = new Date(nowMs);
  start.setUTCMonth(start.getUTCMonth() - IMPORT_WINDOW_MONTHS);
  return start.getTime();
}

/** Maps a Lichess export record to a `game` row, or null when it cannot be stored. */
function toGameRow(userId: string, profile: Profile, item: LichessGame): GameInsert | null {
  let headers: Record<string, string>;
  try {
    headers = parseGame(item.pgn).headers;
  } catch {
    return null;
  }

  let userColor: "white" | "black" | null = null;
  if (item.players.white.user?.id === profile.lichessId) {
    userColor = "white";
  } else if (item.players.black.user?.id === profile.lichessId) {
    userColor = "black";
  } else if (headers.White?.toLowerCase() === profile.username.toLowerCase()) {
    userColor = "white";
  } else if (headers.Black?.toLowerCase() === profile.username.toLowerCase()) {
    userColor = "black";
  }
  if (!userColor) return null;

  const [initialRaw, incrementRaw] = (headers.TimeControl ?? "").split("+");
  const initial =
    item.clock?.initial ?? (initialRaw && /^\d+$/.test(initialRaw) ? Number(initialRaw) : null);
  const increment =
    item.clock?.increment ??
    (incrementRaw && /^\d+$/.test(incrementRaw) ? Number(incrementRaw) : null);

  let result = headers.Result ?? "";
  if (!RESULTS.has(result)) {
    result = item.winner === "white" ? "1-0" : item.winner === "black" ? "0-1" : "*";
  }

  return {
    userId,
    lichessGameId: item.id,
    pgn: item.pgn,
    userColor,
    speed: item.speed,
    timeControlInitialS: initial,
    timeControlIncrementS: increment,
    rated: item.rated,
    result: result as GameInsert["result"],
    eco: item.opening?.eco ?? headers.ECO ?? null,
    openingName: item.opening?.name ?? headers.Opening ?? null,
    playedAt: new Date(item.createdAt),
  };
}

/** Maps a thrown error to the persisted state. Never stores the raw message (it may hold secrets). */
function classifyFailure(error: unknown): {
  state: "backoff" | "failed";
  retryAt: Date | null;
  message: string | null;
} {
  const name = error instanceof Error ? error.name : "";
  if (name === "LichessRateLimited") {
    const retryAt = (error as { retryAt?: unknown }).retryAt;
    return {
      state: "backoff",
      retryAt: typeof retryAt === "number" ? new Date(retryAt) : null,
      message: null,
    };
  }
  return {
    state: "failed",
    retryAt: null,
    message: name === "LichessUnauthorized" ? MESSAGE_UNAUTHORIZED : MESSAGE_GENERIC,
  };
}

/**
 * Persistence and orchestration of the Lichess import (ADR-10): a DB lease keeps one import per
 * user, and the cursor advances in the same transaction as each batch of games, so a restart
 * resumes without duplicates.
 */
export function createImportService({
  db,
  source,
  now = Date.now,
  batchSize = IMPORT_BATCH_SIZE,
}: ImportServiceDeps) {
  async function status(userId: string): Promise<ImportStatus> {
    const [profile] = await db
      .select()
      .from(lichessProfile)
      .where(eq(lichessProfile.userId, userId));
    if (!profile) {
      return { state: "idle", lastSyncedAt: null, retryAt: null, gamesImported: 0 };
    }
    const gamesImported = await db.$count(game, eq(game.userId, userId));
    // A running import whose lease lapsed was interrupted (e.g. a restart): it is resumable.
    const interrupted =
      profile.importState === "running" &&
      (!profile.importLeaseUntil || profile.importLeaseUntil.getTime() <= now());
    return {
      state: interrupted ? "idle" : profile.importState,
      lastSyncedAt: profile.lastSyncedAt,
      retryAt: profile.importRetryAt,
      gamesImported,
    };
  }

  async function acquireLease(userId: string): Promise<Profile | null> {
    const at = new Date(now());
    const [row] = await db
      .update(lichessProfile)
      .set({
        importState: "running",
        importLeaseUntil: new Date(at.getTime() + IMPORT_LEASE_MS),
        importError: null,
        importRetryAt: null,
      })
      .where(
        and(
          eq(lichessProfile.userId, userId),
          or(isNull(lichessProfile.importLeaseUntil), lt(lichessProfile.importLeaseUntil, at)),
          or(isNull(lichessProfile.importRetryAt), lt(lichessProfile.importRetryAt, at)),
        ),
      )
      .returning();
    return row ?? null;
  }

  function ownedBy(userId: string, lease: Date) {
    return and(eq(lichessProfile.userId, userId), eq(lichessProfile.importLeaseUntil, lease));
  }

  /**
   * Persists one batch and advances the cursor, fenced by lease ownership: the lease value this
   * run last wrote is its token, so a run whose lease was taken over matches no row and writes
   * nothing. Returns the extended lease, or null when the lease was lost.
   */
  async function commitBatch(
    userId: string,
    lease: Date,
    rows: GameInsert[],
    cursorMs: number,
  ): Promise<Date | null> {
    return db.transaction(async (tx) => {
      const [owned] = await tx
        .update(lichessProfile)
        .set({
          // Never backwards, even if a batch only holds games older than the cursor.
          importCursorMs: sql`GREATEST(COALESCE(${lichessProfile.importCursorMs}, ${cursorMs}), ${cursorMs})`,
          importLeaseUntil: new Date(now() + IMPORT_LEASE_MS),
        })
        .where(and(eq(lichessProfile.userId, userId), eq(lichessProfile.importLeaseUntil, lease)))
        .returning({ lease: lichessProfile.importLeaseUntil });
      if (!owned) return null;
      if (rows.length > 0) {
        const inserted = await tx
          .insert(game)
          .values(rows)
          .onConflictDoNothing()
          .returning({ id: game.id });
        if (inserted.length > 0) {
          await tx
            .insert(gameAnalysis)
            .values(inserted.map((row) => ({ gameId: row.id, userId })))
            .onConflictDoNothing();
        }
      }
      return owned.lease;
    });
  }

  async function runImport(userId: string, profile: Profile, signal: AbortSignal): Promise<void> {
    const firstImport = profile.firstImportDoneAt === null;
    // Incremental syncs start a lookback before the cursor (late-finishing games); the first
    // import starts at its window. `maxCreatedAt` starts at the stored cursor so it never regresses.
    const resumeFromMs =
      profile.importCursorMs ??
      (profile.lastSyncedAt && !firstImport ? profile.lastSyncedAt.getTime() : null);
    const sinceMs =
      resumeFromMs === null
        ? windowStartMs(now())
        : firstImport
          ? resumeFromMs
          : resumeFromMs - IMPORT_LOOKBACK_MS;
    // The lease this run holds; it changes on every commit and fences every write below.
    let lease = profile.importLeaseUntil as Date;

    let pending: GameInsert[] = [];
    let maxCreatedAt = (resumeFromMs ?? sinceMs) - 1;
    let received = 0;

    try {
      const stream = source.exportGames({
        userId,
        username: profile.username,
        sinceMs,
        ...(firstImport ? { max: FIRST_IMPORT_MAX_GAMES } : {}),
        signal,
      });
      let batchSeen = 0;
      for await (const item of stream) {
        // Aborted (shutdown): stop without touching the lease; it expires and the next trigger
        // resumes from the committed cursor.
        if (signal.aborted) return;
        if (firstImport && received >= FIRST_IMPORT_MAX_GAMES) break;
        received += 1;
        batchSeen += 1;
        maxCreatedAt = Math.max(maxCreatedAt, item.createdAt);
        const row = toGameRow(userId, profile, item);
        if (row) pending.push(row);
        if (batchSeen >= batchSize) {
          const next = await commitBatch(userId, lease, pending, maxCreatedAt + 1);
          if (!next) return; // lease lost: a newer run owns the import
          lease = next;
          pending = [];
          batchSeen = 0;
        }
      }
      if (signal.aborted) return;
      if (batchSeen > 0) {
        const next = await commitBatch(userId, lease, pending, maxCreatedAt + 1);
        if (!next) return;
        lease = next;
      }
      const finishedAt = new Date(now());
      await db
        .update(lichessProfile)
        .set({
          importState: "idle",
          lastSyncedAt: finishedAt,
          firstImportDoneAt: profile.firstImportDoneAt ?? finishedAt,
          importLeaseUntil: null,
          importRetryAt: null,
          importError: null,
        })
        .where(ownedBy(userId, lease));
    } catch (error) {
      if (signal.aborted) return;
      const failure = classifyFailure(error);
      await db
        .update(lichessProfile)
        .set({
          importState: failure.state,
          importRetryAt: failure.retryAt,
          importError: failure.message,
          importLeaseUntil: null,
        })
        .where(ownedBy(userId, lease));
    }
  }

  /**
   * Takes the lease and returns right away with the status; `done` settles when the import ends.
   * A held lease or an active backoff means nothing runs and `done` is already settled. Never
   * throws for "already running".
   */
  async function startSync(
    userId: string,
    signal: AbortSignal,
  ): Promise<{ status: ImportStatus; done: Promise<void> }> {
    const profile = await acquireLease(userId);
    if (!profile) {
      return { status: await status(userId), done: Promise.resolve() };
    }
    const running = await status(userId);
    return { status: running, done: runImport(userId, profile, signal) };
  }

  /** Runs one sync to completion and returns the resulting status. */
  async function requestSync(userId: string, signal: AbortSignal): Promise<ImportStatus> {
    const started = await startSync(userId, signal);
    await started.done;
    return status(userId);
  }

  return { status, startSync, requestSync };
}

export type ImportService = ReturnType<typeof createImportService>;
