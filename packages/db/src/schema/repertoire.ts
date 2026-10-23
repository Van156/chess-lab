import { index, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { userColor } from "./games";

const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull();

/** A named opening repertoire for one colour (FR-02). */
export const repertoire = pgTable(
  "repertoire",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: userId(),
    color: userColor("color").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("repertoire_userId_idx").on(table.userId)],
);

/**
 * A node of the repertoire graph, keyed by normalized FEN so transpositions collapse to one row
 * (FR-02). `position_key` is the `positionKey()` of `packages/chess`.
 */
export const repertoirePosition = pgTable(
  "repertoire_position",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    repertoireId: text("repertoire_id")
      .notNull()
      .references(() => repertoire.id, { onDelete: "cascade" }),
    userId: userId(),
    positionKey: text("position_key").notNull(),
    fen: text("fen").notNull(),
    sideToMove: text("side_to_move", { enum: ["w", "b"] }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("repertoirePosition_repertoireId_positionKey_uq").on(
      table.repertoireId,
      table.positionKey,
    ),
    index("repertoirePosition_userId_idx").on(table.userId),
  ],
);

/** A move edge between two positions of the same repertoire. Cycles are rejected in `packages/chess`. */
export const repertoireMove = pgTable(
  "repertoire_move",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    repertoireId: text("repertoire_id")
      .notNull()
      .references(() => repertoire.id, { onDelete: "cascade" }),
    userId: userId(),
    fromPositionId: text("from_position_id")
      .notNull()
      .references(() => repertoirePosition.id, { onDelete: "cascade" }),
    toPositionId: text("to_position_id")
      .notNull()
      .references(() => repertoirePosition.id, { onDelete: "cascade" }),
    san: text("san").notNull(),
    uci: text("uci").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("repertoireMove_fromPositionId_uci_uq").on(table.fromPositionId, table.uci),
    index("repertoireMove_repertoireId_idx").on(table.repertoireId),
    index("repertoireMove_toPositionId_idx").on(table.toPositionId),
    index("repertoireMove_userId_idx").on(table.userId),
  ],
);

/**
 * The annotation of a position (FR-03), 0..1 per position. `plan` is one line of at most 140
 * characters; that limit is validated in the P2-b router, not by a CHECK.
 */
export const ideaNote = pgTable(
  "idea_note",
  {
    repertoirePositionId: text("repertoire_position_id")
      .primaryKey()
      .references(() => repertoirePosition.id, { onDelete: "cascade" }),
    userId: userId(),
    arrows: jsonb("arrows"),
    highlights: jsonb("highlights"),
    plan: text("plan"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("ideaNote_userId_idx").on(table.userId)],
);
