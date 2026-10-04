import type { Database } from "@b2c-template/db";
import { userSettings } from "@b2c-template/db/schema/settings";
import { eq } from "drizzle-orm";

export type UserSettings = Omit<typeof userSettings.$inferSelect, "userId">;
export type SettingsPatch = Partial<Pick<UserSettings, "dailyNewCardLimit" | "timeZone">>;

const toSettings = ({ userId: _userId, ...rest }: typeof userSettings.$inferSelect): UserSettings =>
  rest;

/** Reads the user's settings, creating the default row on first read (lazy upsert, ADR-06). */
export async function getSettings(db: Database, userId: string): Promise<UserSettings> {
  await db.insert(userSettings).values({ userId }).onConflictDoNothing();
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (!row) throw new Error("user_settings row missing after upsert");
  return toSettings(row);
}

/** Applies a partial update, creating the row first when needed. */
export async function updateSettings(
  db: Database,
  userId: string,
  patch: SettingsPatch,
): Promise<UserSettings> {
  await getSettings(db, userId);
  if (Object.keys(patch).length === 0) return getSettings(db, userId);
  const [row] = await db
    .update(userSettings)
    .set(patch)
    .where(eq(userSettings.userId, userId))
    .returning();
  if (!row) throw new Error("user_settings row missing after update");
  return toSettings(row);
}
