import { boolean, integer, pgTable, smallint, text } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Per-user settings; the better-auth `user` table is never extended. Created lazily (upsert). */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  dailyNewCardLimit: integer("daily_new_card_limit").default(20).notNull(),
  // IANA zone, set from the browser.
  timeZone: text("time_zone").default("UTC").notNull(),
  boardOrientationAuto: boolean("board_orientation_auto").default(true).notNull(),
  // Phase 2.
  explorerBandOffset: smallint("explorer_band_offset").default(0).notNull(),
  // Phase 3.
  blindfoldLevel: smallint("blindfold_level").default(1).notNull(),
});
