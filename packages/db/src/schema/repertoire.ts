import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

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
  (table) => [
    index("repertoire_userId_idx").on(table.userId),
    // Target of the composite foreign keys that tie child rows to the repertoire's owner.
    unique("repertoire_id_userId_uq").on(table.id, table.userId),
  ],
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
    repertoireId: text("repertoire_id").notNull(),
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
    // Targets of the composite foreign keys of moves, idea notes and cards.
    unique("repertoirePosition_id_repertoireId_userId_uq").on(
      table.id,
      table.repertoireId,
      table.userId,
    ),
    unique("repertoirePosition_id_userId_uq").on(table.id, table.userId),
    foreignKey({
      name: "repertoirePosition_repertoire_owner_fk",
      columns: [table.repertoireId, table.userId],
      foreignColumns: [repertoire.id, repertoire.userId],
    }).onDelete("cascade"),
    check("repertoire_position_side_to_move_check", sql`${table.sideToMove} in ('w', 'b')`),
  ],
);

/**
 * A move edge between two positions. The database enforces that the repertoire, both positions and
 * the move all belong to the same repertoire and user (composite foreign keys). It does not reject
 * cycles: that lives in `addMove` of `packages/chess`, which the router must apply before inserting.
 */
export const repertoireMove = pgTable(
  "repertoire_move",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    repertoireId: text("repertoire_id").notNull(),
    userId: userId(),
    fromPositionId: text("from_position_id").notNull(),
    toPositionId: text("to_position_id").notNull(),
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
    foreignKey({
      name: "repertoireMove_repertoire_owner_fk",
      columns: [table.repertoireId, table.userId],
      foreignColumns: [repertoire.id, repertoire.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "repertoireMove_from_position_fk",
      columns: [table.fromPositionId, table.repertoireId, table.userId],
      foreignColumns: [
        repertoirePosition.id,
        repertoirePosition.repertoireId,
        repertoirePosition.userId,
      ],
    }).onDelete("cascade"),
    foreignKey({
      name: "repertoireMove_to_position_fk",
      columns: [table.toPositionId, table.repertoireId, table.userId],
      foreignColumns: [
        repertoirePosition.id,
        repertoirePosition.repertoireId,
        repertoirePosition.userId,
      ],
    }).onDelete("cascade"),
  ],
);

/**
 * The annotation of a position (FR-03), 0..1 per position. `plan` is one line of at most 140
 * characters; that limit is validated in the P2-b router, not by a CHECK.
 */
export const ideaNote = pgTable(
  "idea_note",
  {
    repertoirePositionId: text("repertoire_position_id").primaryKey(),
    userId: userId(),
    arrows: jsonb("arrows"),
    highlights: jsonb("highlights"),
    plan: text("plan"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("ideaNote_userId_idx").on(table.userId),
    foreignKey({
      name: "ideaNote_position_owner_fk",
      columns: [table.repertoirePositionId, table.userId],
      foreignColumns: [repertoirePosition.id, repertoirePosition.userId],
    }).onDelete("cascade"),
  ],
);
