import { bigint, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const lichessImportState = pgEnum("lichess_import_state", [
  "idle",
  "running",
  "backoff",
  "failed",
]);

/**
 * One row per user who signed in with Lichess (ADR-06). `lichess_id` is the lowercase immutable
 * account id; the import columns hold the resumable-sync state (cursor, lease, backoff).
 */
export const lichessProfile = pgTable("lichess_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lichessId: text("lichess_id").notNull().unique(),
  username: text("username").notNull(),
  // Perf ratings from `/api/account`.
  ratingSnapshot: jsonb("rating_snapshot"),
  importCursorMs: bigint("import_cursor_ms", { mode: "number" }),
  importState: lichessImportState("import_state").default("idle").notNull(),
  importRetryAt: timestamp("import_retry_at", { withTimezone: true }),
  importLeaseUntil: timestamp("import_lease_until", { withTimezone: true }),
  importError: text("import_error"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  firstImportDoneAt: timestamp("first_import_done_at", { withTimezone: true }),
});
