import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userColor = pgEnum("user_color", ["white", "black"]);
export const gameResult = pgEnum("game_result", ["1-0", "0-1", "1/2-1/2", "*"]);
export const analysisStatus = pgEnum("analysis_status", [
  "pending",
  "screening",
  "confirming",
  "complete",
  "failed",
]);
export const severity = pgEnum("severity", ["inaccuracy", "mistake", "blunder"]);
export const phase = pgEnum("phase", ["opening", "middlegame", "endgame"]);

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

/** An imported Lichess game. Unique `(user_id, lichess_game_id)` makes import idempotent. */
export const game = pgTable(
  "game",
  {
    id: id(),
    userId: userId(),
    lichessGameId: text("lichess_game_id").notNull(),
    pgn: text("pgn").notNull(),
    userColor: userColor("user_color").notNull(),
    speed: text("speed").notNull(),
    timeControlInitialS: integer("time_control_initial_s"),
    timeControlIncrementS: integer("time_control_increment_s"),
    rated: boolean("rated").notNull(),
    result: gameResult("result").notNull(),
    eco: text("eco"),
    openingName: text("opening_name"),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("game_userId_lichessGameId_uidx").on(table.userId, table.lichessGameId),
    index("game_userId_playedAt_idx").on(table.userId, sql`${table.playedAt} desc`),
  ],
);

/** Engine analysis state of one game. `evals[ply]` is `{ cp?, mate?, depth, bestUci? }` or null. */
export const gameAnalysis = pgTable(
  "game_analysis",
  {
    gameId: text("game_id")
      .primaryKey()
      .references(() => game.id, { onDelete: "cascade" }),
    userId: userId(),
    status: analysisStatus("status").default("pending").notNull(),
    evals: jsonb("evals"),
    screenDepth: integer("screen_depth"),
    confirmDepth: integer("confirm_depth"),
    // Worker file name and version.
    engineId: text("engine_id"),
    nextPly: integer("next_ply").default(0).notNull(),
    analysedAt: timestamp("analysed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("gameAnalysis_userId_status_idx").on(table.userId, table.status)],
);

/** A classified mistake (ADR-05). Unique `(game_id, ply)` keeps re-classification idempotent. */
export const mistake = pgTable(
  "mistake",
  {
    id: id(),
    userId: userId(),
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    ply: integer("ply").notNull(),
    fenBefore: text("fen_before").notNull(),
    // Normalized FEN (see GLOSSARY.md), the indexed position identity.
    positionKey: text("position_key").notNull(),
    playedSan: text("played_san").notNull(),
    playedUci: text("played_uci").notNull(),
    bestSan: text("best_san").notNull(),
    bestUci: text("best_uci").notNull(),
    evalBeforeCp: integer("eval_before_cp").notNull(),
    evalAfterCp: integer("eval_after_cp").notNull(),
    evalLossCp: integer("eval_loss_cp").notNull(),
    severity: severity("severity").notNull(),
    phase: phase("phase").notNull(),
    clockLeftMs: integer("clock_left_ms"),
    clockInitialMs: integer("clock_initial_ms"),
    eco: text("eco"),
    openingName: text("opening_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("mistake_gameId_ply_uidx").on(table.gameId, table.ply),
    index("mistake_userId_positionKey_playedUci_idx").on(
      table.userId,
      table.positionKey,
      table.playedUci,
    ),
    index("mistake_userId_eco_idx").on(table.userId, table.eco),
  ],
);
