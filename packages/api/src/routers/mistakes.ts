import { clampLimit, MAX_PAGE_SIZE } from "@b2c-template/db/lib/pagination";
import { game, mistake } from "@b2c-template/db/schema/games";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { featureProcedure } from "../index";
import {
  cursorId,
  cursorPly,
  cursorTimestamp,
  decodeCursor,
  encodeCursor,
} from "../services/cursor";

const mistakesCursor = z.tuple([cursorTimestamp, cursorId, cursorPly]);

const listInput = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.int().min(1).max(MAX_PAGE_SIZE).optional(),
  gameId: z.string().min(1).optional(),
});

const mistakeColumns = {
  id: mistake.id,
  gameId: mistake.gameId,
  ply: mistake.ply,
  fenBefore: mistake.fenBefore,
  playedSan: mistake.playedSan,
  playedUci: mistake.playedUci,
  bestSan: mistake.bestSan,
  bestUci: mistake.bestUci,
  evalBeforeCp: mistake.evalBeforeCp,
  evalAfterCp: mistake.evalAfterCp,
  evalLossCp: mistake.evalLossCp,
  severity: mistake.severity,
  phase: mistake.phase,
  clockLeftMs: mistake.clockLeftMs,
  clockInitialMs: mistake.clockInitialMs,
  eco: mistake.eco,
  openingName: mistake.openingName,
  playedAt: game.playedAt,
};

/**
 * Mistakes (ADR-19), behind the `mistakes` pillar flag. The user id comes from the session only
 * and is combined into every WHERE clause on both the mistake and its game.
 */
export const mistakesRouter = {
  /**
   * Keyset-paged list, newest game first by `(playedAt, gameId, ply)`, optionally narrowed to one
   * game. Output: `{ items: { id, gameId, ply, fenBefore, playedSan, playedUci, bestSan, bestUci,
   * evalBeforeCp, evalAfterCp, evalLossCp, severity, phase, clockLeftMs, clockInitialMs, eco,
   * openingName, playedAt }[], nextCursor: string | null }`.
   */
  list: featureProcedure("mistakes")
    .input(listInput.optional().transform((value) => value ?? {}))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const limit = clampLimit(input.limit);
      const after = input.cursor ? decodeCursor(input.cursor, mistakesCursor) : null;
      const [playedAt, gameId, ply] = after ?? [];
      const rows = await context.db
        .select(mistakeColumns)
        .from(mistake)
        .innerJoin(game, and(eq(game.id, mistake.gameId), eq(game.userId, userId)))
        .where(
          and(
            eq(mistake.userId, userId),
            input.gameId ? eq(mistake.gameId, input.gameId) : undefined,
            after
              ? sql`(${game.playedAt}, ${mistake.gameId}, ${mistake.ply}) < (${playedAt}::timestamptz, ${gameId}, ${ply}::int)`
              : undefined,
          ),
        )
        .orderBy(desc(game.playedAt), desc(mistake.gameId), desc(mistake.ply))
        .limit(limit + 1);
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > limit && last
            ? encodeCursor([last.playedAt.toISOString(), last.gameId, last.ply])
            : null,
      };
    }),
  /**
   * One mistake plus its game (`{ id, lichessGameId, pgn, userColor, result, playedAt }`);
   * NOT_FOUND when missing or not the caller's.
   */
  get: featureProcedure("mistakes")
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const [row] = await context.db
        .select({
          ...mistakeColumns,
          positionKey: mistake.positionKey,
          createdAt: mistake.createdAt,
          game: {
            id: game.id,
            lichessGameId: game.lichessGameId,
            pgn: game.pgn,
            userColor: game.userColor,
            result: game.result,
            playedAt: game.playedAt,
          },
        })
        .from(mistake)
        .innerJoin(game, and(eq(game.id, mistake.gameId), eq(game.userId, userId)))
        .where(and(eq(mistake.id, input.id), eq(mistake.userId, userId)))
        .limit(1);
      if (!row) throw new ORPCError("NOT_FOUND");
      return row;
    }),
};
