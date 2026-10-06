import { game, gameAnalysis } from "@b2c-template/db/schema/games";
import { clampLimit, MAX_PAGE_SIZE } from "@b2c-template/db/lib/pagination";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { decodeCursor, encodeCursor } from "../services/cursor";

const listInput = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.int().min(1).max(MAX_PAGE_SIZE).optional(),
});

const listColumns = {
  id: game.id,
  lichessGameId: game.lichessGameId,
  userColor: game.userColor,
  speed: game.speed,
  rated: game.rated,
  result: game.result,
  eco: game.eco,
  openingName: game.openingName,
  playedAt: game.playedAt,
  importedAt: game.importedAt,
  // A game with no analysis row yet is still waiting to be analysed.
  analysisStatus: sql<
    "pending" | "screening" | "confirming" | "complete" | "failed"
  >`coalesce(${gameAnalysis.status}, 'pending')`,
};

/**
 * Imported games (ADR-19). The user id comes from the session only and is combined into every
 * WHERE clause, so a foreign game is indistinguishable from a missing one. Sync status and
 * "Sync now" already live on `lichess.status` / `lichess.sync`.
 */
export const gamesRouter = {
  /**
   * Keyset-paged list, newest first by `(playedAt, id)`. Output:
   * `{ items: { id, lichessGameId, userColor, speed, rated, result, eco, openingName, playedAt,
   * importedAt, analysisStatus }[], nextCursor: string | null }`.
   */
  list: protectedProcedure
    .input(listInput.optional().transform((value) => value ?? {}))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const limit = clampLimit(input.limit);
      const after = input.cursor ? decodeCursor(input.cursor, 2) : null;
      const [playedAt, id] = after ?? [];
      if (after && (typeof playedAt !== "string" || typeof id !== "string")) {
        throw new ORPCError("BAD_REQUEST", { message: "Invalid cursor" });
      }
      const rows = await context.db
        .select(listColumns)
        .from(game)
        .leftJoin(gameAnalysis, eq(gameAnalysis.gameId, game.id))
        .where(
          and(
            eq(game.userId, userId),
            after
              ? sql`(${game.playedAt}, ${game.id}) < (${playedAt}::timestamptz, ${id})`
              : undefined,
          ),
        )
        .orderBy(desc(game.playedAt), desc(game.id))
        .limit(limit + 1);
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > limit && last ? encodeCursor([last.playedAt.toISOString(), last.id]) : null,
      };
    }),
  /** One game with its PGN and analysis state; NOT_FOUND when missing or not the caller's. */
  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const [row] = await context.db
        .select({
          ...listColumns,
          pgn: game.pgn,
          timeControlInitialS: game.timeControlInitialS,
          timeControlIncrementS: game.timeControlIncrementS,
          nextPly: sql<number>`coalesce(${gameAnalysis.nextPly}, 0)`,
        })
        .from(game)
        .leftJoin(gameAnalysis, eq(gameAnalysis.gameId, game.id))
        .where(and(eq(game.id, input.id), eq(game.userId, context.session.user.id)))
        .limit(1);
      if (!row) throw new ORPCError("NOT_FOUND");
      return row;
    }),
};
