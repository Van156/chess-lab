import { classifyGame, CARD_SEVERITIES, EVAL_CLAMP_CP, parseGame } from "@b2c-template/chess";
import type { PlyEval } from "@b2c-template/chess";
import type { Database } from "@b2c-template/db";
import { card } from "@b2c-template/db/schema/cards";
import { game, gameAnalysis, mistake } from "@b2c-template/db/schema/games";
import { newCardState } from "@b2c-template/study";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, ne, sql } from "drizzle-orm";

import { completeSchema, submitEvalsSchema } from "./analysis-config";
import type { CompleteInput, SubmitEvalsInput } from "./analysis-config";

export type AnalysisState = {
  gameId: string;
  pgn: string;
  userColor: "white" | "black";
  status: "pending" | "screening" | "confirming";
  evals: PlyEval[];
  nextPly: number;
  screenDepth: number | null;
  confirmDepth: number | null;
  engineId: string | null;
};

export type SubmitEvalsResult = { status: "screening" | "confirming"; nextPly: number };
export type CompleteResult = { gameId: string; mistakes: number; cardsCreated: number };
export type RepeatMistake = {
  positionKey: string;
  playedUci: string;
  occurrences: number;
  games: number;
};

export type AnalysisServiceDeps = { db: Database; now?: () => Date };

const badRequest = (message: string) => new ORPCError("BAD_REQUEST", { message });
const notFound = () => new ORPCError("NOT_FOUND", { message: "Game not found." });

/** Plies of a stored game; an unreadable PGN is a bad request, not a server fault. */
function plyCount(pgn: string): number {
  try {
    return parseGame(pgn).plies.length;
  } catch {
    throw badRequest("The game cannot be read.");
  }
}

const clampCp = (e: NonNullable<PlyEval>): NonNullable<PlyEval> =>
  e.cp === undefined
    ? e
    : { ...e, cp: Math.max(-EVAL_CLAMP_CP, Math.min(EVAL_CLAMP_CP, e.cp)) + 0 };

const asEvals = (value: unknown): PlyEval[] => (Array.isArray(value) ? (value as PlyEval[]) : []);

/**
 * Analysis pipeline persistence (ADR-12): the browser submits per-ply evaluations; the server owns
 * mistake and card creation. Every query filters by the session user id.
 */
export function createAnalysisService({ db, now = () => new Date() }: AnalysisServiceDeps) {
  /** The user's oldest game that still needs analysis, with stored evals and the resume point. */
  async function next(userId: string): Promise<AnalysisState | null> {
    const [row] = await db
      .select({
        gameId: game.id,
        pgn: game.pgn,
        userColor: game.userColor,
        status: gameAnalysis.status,
        evals: gameAnalysis.evals,
        nextPly: gameAnalysis.nextPly,
        screenDepth: gameAnalysis.screenDepth,
        confirmDepth: gameAnalysis.confirmDepth,
        engineId: gameAnalysis.engineId,
      })
      .from(gameAnalysis)
      .innerJoin(game, and(eq(game.id, gameAnalysis.gameId), eq(game.userId, userId)))
      .where(
        and(
          eq(gameAnalysis.userId, userId),
          ne(gameAnalysis.status, "complete"),
          ne(gameAnalysis.status, "failed"),
        ),
      )
      .orderBy(asc(game.playedAt), asc(game.id))
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      status: row.status as AnalysisState["status"],
      evals: asEvals(row.evals),
    };
  }

  /** Merges a batch by ply index. Idempotent: a re-sent ply never replaces a deeper evaluation. */
  async function submitEvals(userId: string, input: SubmitEvalsInput): Promise<SubmitEvalsResult> {
    const parsed = submitEvalsSchema.safeParse(input);
    if (!parsed.success) throw badRequest("Invalid evaluations.");
    const { gameId, fromPly, evals, phase, engineId } = parsed.data;

    return db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          pgn: game.pgn,
          status: gameAnalysis.status,
          stored: gameAnalysis.evals,
          nextPly: gameAnalysis.nextPly,
          screenDepth: gameAnalysis.screenDepth,
          confirmDepth: gameAnalysis.confirmDepth,
        })
        .from(gameAnalysis)
        .innerJoin(game, and(eq(game.id, gameAnalysis.gameId), eq(game.userId, userId)))
        .where(and(eq(gameAnalysis.gameId, gameId), eq(gameAnalysis.userId, userId)))
        .for("update", { of: gameAnalysis });
      if (!row) throw notFound();
      if (row.status === "complete") {
        throw new ORPCError("CONFLICT", { message: "Analysis already complete." });
      }

      // Evals index positions 0..plies (the position after `i` plies).
      const plies = plyCount(row.pgn);
      if (fromPly + evals.length - 1 > plies) throw badRequest("Plies out of range.");

      const merged = [...asEvals(row.stored)];
      let batchDepth = 0;
      evals.forEach((incoming, offset) => {
        if (!incoming) return;
        const ply = fromPly + offset;
        const existing = merged[ply];
        batchDepth = Math.max(batchDepth, incoming.depth);
        if (!existing || incoming.depth >= existing.depth) merged[ply] = clampCp(incoming);
      });
      // Holes in the array would serialize as JSON null, which is the documented "no eval" value.
      for (let i = 0; i < merged.length; i++) merged[i] ??= null;

      const nextPly =
        phase === "screen" ? Math.max(row.nextPly, fromPly + evals.length) : row.nextPly;
      const status =
        phase === "confirm" || row.status === "confirming" ? "confirming" : "screening";
      await tx
        .update(gameAnalysis)
        .set({
          evals: merged,
          nextPly,
          status,
          ...(phase === "screen"
            ? { screenDepth: Math.max(row.screenDepth ?? 0, batchDepth) || null }
            : { confirmDepth: Math.max(row.confirmDepth ?? 0, batchDepth) || null }),
          ...(engineId ? { engineId } : {}),
        })
        .where(and(eq(gameAnalysis.gameId, gameId), eq(gameAnalysis.userId, userId)));
      return { status, nextPly };
    });
  }

  /**
   * Classifies the game from its stored evals and, in one transaction, upserts the mistakes, creates
   * one New card per carded mistake (never a duplicate) and marks the analysis complete.
   */
  async function complete(userId: string, input: CompleteInput): Promise<CompleteResult> {
    const { gameId } = completeSchema.parse(input);

    const outcome = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          game,
          stored: gameAnalysis.evals,
          nextPly: gameAnalysis.nextPly,
        })
        .from(gameAnalysis)
        .innerJoin(game, and(eq(game.id, gameAnalysis.gameId), eq(game.userId, userId)))
        .where(and(eq(gameAnalysis.gameId, gameId), eq(gameAnalysis.userId, userId)))
        .for("update", { of: gameAnalysis });
      if (!row) throw notFound();
      const { game: g } = row;

      let plies: number;
      try {
        plies = parseGame(g.pgn).plies.length;
      } catch {
        return { unreadable: true as const };
      }
      if (row.nextPly < plies) {
        throw new ORPCError("CONFLICT", { message: "Analysis is not finished." });
      }
      // The position after the last ply may be unevaluated (game over); its move is then skipped.
      const classified = classifyGame({
        pgn: g.pgn,
        evals: asEvals(row.stored),
        userColor: g.userColor === "white" ? "w" : "b",
      });

      const current = now();
      let cardsCreated = 0;
      for (const m of classified) {
        const [saved] = await tx
          .insert(mistake)
          .values({
            userId,
            gameId,
            ply: m.ply,
            fenBefore: m.fenBefore,
            positionKey: m.positionKey,
            playedSan: m.playedSan,
            playedUci: m.playedUci,
            bestSan: m.bestSan,
            bestUci: m.bestUci,
            evalBeforeCp: m.evalBeforeCp,
            evalAfterCp: m.evalAfterCp,
            evalLossCp: m.evalLossCp,
            severity: m.severity,
            phase: m.phase,
            clockLeftMs: m.clockLeftMs,
            clockInitialMs: m.clockInitialMs,
            eco: g.eco,
            openingName: g.openingName,
          })
          .onConflictDoUpdate({
            target: [mistake.gameId, mistake.ply],
            set: {
              fenBefore: m.fenBefore,
              positionKey: m.positionKey,
              playedSan: m.playedSan,
              playedUci: m.playedUci,
              bestSan: m.bestSan,
              bestUci: m.bestUci,
              evalBeforeCp: m.evalBeforeCp,
              evalAfterCp: m.evalAfterCp,
              evalLossCp: m.evalLossCp,
              severity: m.severity,
              phase: m.phase,
              clockLeftMs: m.clockLeftMs,
              clockInitialMs: m.clockInitialMs,
              eco: g.eco,
              openingName: g.openingName,
            },
          })
          .returning({ id: mistake.id });
        if (!saved || !CARD_SEVERITIES.includes(m.severity)) continue;

        const fresh = newCardState(current);
        const created = await tx
          .insert(card)
          .values({
            userId,
            mistakeId: saved.id,
            due: fresh.due,
            stability: fresh.stability,
            difficulty: fresh.difficulty,
            elapsedDays: fresh.elapsedDays,
            scheduledDays: fresh.scheduledDays,
            learningSteps: fresh.learningSteps,
            reps: fresh.reps,
            lapses: fresh.lapses,
            state: fresh.state,
            lastReview: fresh.lastReview,
          })
          .onConflictDoNothing({ target: card.mistakeId })
          .returning({ id: card.id });
        cardsCreated += created.length;
      }

      await tx
        .update(gameAnalysis)
        .set({ status: "complete", analysedAt: current })
        .where(and(eq(gameAnalysis.gameId, gameId), eq(gameAnalysis.userId, userId)));
      return { unreadable: false as const, mistakes: classified.length, cardsCreated };
    });

    if (outcome.unreadable) {
      // Outside the rolled-back work: a game that cannot be parsed must stop blocking `next`.
      await db
        .update(gameAnalysis)
        .set({ status: "failed" })
        .where(and(eq(gameAnalysis.gameId, gameId), eq(gameAnalysis.userId, userId)));
      throw badRequest("The game cannot be read.");
    }
    return { gameId, mistakes: outcome.mistakes, cardsCreated: outcome.cardsCreated };
  }

  /**
   * Mistakes the user repeated: the same position and the same played move in two or more games
   * (PRD repeat-mistake metric, consumed by Progress).
   */
  async function repeatMistakes(userId: string): Promise<RepeatMistake[]> {
    const games = sql<number>`count(distinct ${mistake.gameId})::int`;
    return db
      .select({
        positionKey: mistake.positionKey,
        playedUci: mistake.playedUci,
        occurrences: sql<number>`count(*)::int`,
        games,
      })
      .from(mistake)
      .where(eq(mistake.userId, userId))
      .groupBy(mistake.positionKey, mistake.playedUci)
      .having(sql`${games} >= 2`)
      .orderBy(sql`count(*) desc`, asc(mistake.positionKey), asc(mistake.playedUci));
  }

  return { next, submitEvals, complete, repeatMistakes };
}

export type AnalysisService = ReturnType<typeof createAnalysisService>;
