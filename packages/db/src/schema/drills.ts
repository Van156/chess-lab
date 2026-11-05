import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** The blindfold drills a session can record. The CHECK below is built from this tuple. */
export const DRILL_KINDS = [
  "square_colour",
  "coordinates",
  "diagonals",
  "knight_distance",
  "same_diagonal",
  "check_detection",
  "position_recall",
  "mate_in_one",
] as const;
export type DrillKind = (typeof DRILL_KINDS)[number];

/** One finished blindfold drill session: `correct` of `total` questions in `durationMs`. */
export const drillSession = pgTable(
  "drill_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    drill: text("drill").$type<DrillKind>().notNull(),
    level: smallint("level").notNull(),
    correct: smallint("correct").notNull(),
    total: smallint("total").notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "drill_session_drill_check",
      sql`${table.drill} in (${sql.join(
        DRILL_KINDS.map((kind) => sql`${kind}`),
        sql`, `,
      )})`,
    ),
    check("drill_session_level_check", sql`${table.level} >= 1`),
    check(
      "drill_session_score_check",
      sql`${table.total} >= 1 and ${table.correct} >= 0 and ${table.correct} <= ${table.total}`,
    ),
    check("drill_session_duration_check", sql`${table.durationMs} >= 0`),
    index("drillSession_userId_drill_createdAt_idx").on(table.userId, table.drill, table.createdAt),
  ],
);
