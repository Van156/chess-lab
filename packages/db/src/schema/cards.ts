import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { mistake } from "./games";

const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

/**
 * One review card (ADR-04). Each source has its own nullable unique FK; the CHECK keeps exactly
 * one set. Phase 2 and 3 widen the CHECK when they add their sources. FSRS columns mirror the
 * ts-fsrs `Card`; `state` is 0 New, 1 Learning, 2 Review, 3 Relearning.
 */
export const card = pgTable(
  "card",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: userId(),
    mistakeId: text("mistake_id")
      .unique()
      .references(() => mistake.id, { onDelete: "cascade" }),
    due: timestamp("due", { withTimezone: true }).notNull(),
    stability: real("stability"),
    difficulty: real("difficulty"),
    elapsedDays: integer("elapsed_days"),
    scheduledDays: integer("scheduled_days"),
    learningSteps: integer("learning_steps"),
    reps: integer("reps"),
    lapses: integer("lapses"),
    state: smallint("state").default(0).notNull(),
    lastReview: timestamp("last_review", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check("card_exactly_one_source", sql`num_nonnulls(${table.mistakeId}) = 1`),
    index("card_userId_due_idx").on(table.userId, table.due),
    index("card_userId_state_idx").on(table.userId, table.state),
  ],
);

/** Append-only review history; `id` is the client-generated UUID (the idempotency key). */
export const reviewLog = pgTable(
  "review_log",
  {
    id: text("id").primaryKey(),
    userId: userId(),
    cardId: text("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    grade: smallint("grade").notNull(),
    // Client clock.
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    elapsedMs: integer("elapsed_ms").notNull(),
    stateBefore: jsonb("state_before").notNull(),
    stateAfter: jsonb("state_after").notNull(),
  },
  (table) => [
    index("reviewLog_userId_reviewedAt_idx").on(table.userId, table.reviewedAt),
    index("reviewLog_cardId_reviewedAt_idx").on(table.cardId, table.reviewedAt),
  ],
);
