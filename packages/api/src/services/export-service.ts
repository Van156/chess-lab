import type { Database } from "@b2c-template/db";
import { user } from "@b2c-template/db/schema/auth";
import { card, reviewLog } from "@b2c-template/db/schema/cards";
import { game, gameAnalysis, mistake } from "@b2c-template/db/schema/games";
import { lichessProfile } from "@b2c-template/db/schema/lichess";
import { userSettings } from "@b2c-template/db/schema/settings";
import { and, asc, eq, getColumns, gt } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

/** Rows read per keyset page (ADR-20): bounds memory whatever the size of the history. */
export const EXPORT_PAGE_SIZE = 500;

/**
 * JSON section name -> the table it exports. The schema meta-test requires every table with a
 * `user_id` column to appear here or in its explicit exclusion list, so a later phase cannot ship
 * a user-owned table the export forgets (FR-19). Add repertoire and drill sections here.
 */
export const EXPORT_JSON_SECTIONS = {
  user: "user",
  settings: "user_settings",
  lichessProfile: "lichess_profile",
  games: "game",
  analyses: "game_analysis",
  mistakes: "mistake",
  cards: "card",
  reviewLogs: "review_log",
} as const;

/** Runner state that is not the user's data: the import lease and its backoff bookkeeping. */
const LICHESS_PROFILE_RUNNER_FIELDS = [
  "importLeaseUntil",
  "importRetryAt",
  "importState",
  "importError",
] as const;

type Row = Record<string, unknown>;

/**
 * Streams one table in keyset pages ordered by `keyField` (one property name gives both the
 * column and the row key), scoped to `userId` in the WHERE clause.
 * Yields a JSON array incrementally, one page per chunk.
 */
async function* jsonArray(
  db: Database,
  table: PgTable,
  keyField: string,
  userColumn: PgColumn,
  userId: string,
): AsyncGenerator<string> {
  const keyColumn = getColumns(table)[keyField];
  if (!keyColumn) throw new Error(`export: unknown key field ${keyField}`);
  yield "[";
  let after: string | null = null;
  let first = true;
  for (;;) {
    const rows: Row[] = await db
      .select()
      .from(table)
      .where(and(eq(userColumn, userId), after === null ? undefined : gt(keyColumn, after)))
      .orderBy(asc(keyColumn))
      .limit(EXPORT_PAGE_SIZE);
    if (rows.length === 0) break;
    yield (first ? "" : ",") + rows.map((row) => JSON.stringify(row)).join(",");
    first = false;
    if (rows.length < EXPORT_PAGE_SIZE) break;
    after = String(rows[rows.length - 1]![keyField]);
  }
  yield "]";
}

/**
 * The user's data as one JSON document, written incrementally. Never tokens, session data or the
 * import lease: `account` and `session` are not exported (see the meta-test exclusions) and
 * `lichessProfile` drops the runner fields.
 */
export async function* exportUserJson(db: Database, userId: string): AsyncGenerator<string> {
  const [owner] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
      lichessUsername: lichessProfile.username,
    })
    .from(user)
    .leftJoin(lichessProfile, eq(lichessProfile.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  yield `{"user":${JSON.stringify(owner ?? null)}`;

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  yield `,"settings":${JSON.stringify(settings ?? null)}`;

  const profileColumns = getColumns(lichessProfile);
  const publicProfile = Object.fromEntries(
    Object.entries(profileColumns).filter(
      ([key]) => !(LICHESS_PROFILE_RUNNER_FIELDS as readonly string[]).includes(key),
    ),
  ) as Omit<typeof profileColumns, (typeof LICHESS_PROFILE_RUNNER_FIELDS)[number]>;
  const [profile] = await db
    .select(publicProfile)
    .from(lichessProfile)
    .where(eq(lichessProfile.userId, userId))
    .limit(1);
  yield `,"lichessProfile":${JSON.stringify(profile ?? null)}`;

  yield `,"games":`;
  yield* jsonArray(db, game, "id", game.userId, userId);
  yield `,"analyses":`;
  yield* jsonArray(db, gameAnalysis, "gameId", gameAnalysis.userId, userId);
  yield `,"mistakes":`;
  yield* jsonArray(db, mistake, "id", mistake.userId, userId);
  yield `,"cards":`;
  yield* jsonArray(db, card, "id", card.userId, userId);
  yield `,"reviewLogs":`;
  yield* jsonArray(db, reviewLog, "id", reviewLog.userId, userId);
  yield "}";
}

/** The user's imported games as PGN, in keyset pages, separated by one blank line. */
export async function* exportUserPgn(db: Database, userId: string): AsyncGenerator<string> {
  let after: string | null = null;
  let wrote = false;
  for (;;) {
    const rows: { id: string; pgn: string }[] = await db
      .select({ id: game.id, pgn: game.pgn })
      .from(game)
      .where(and(eq(game.userId, userId), after === null ? undefined : gt(game.id, after)))
      .orderBy(asc(game.id))
      .limit(EXPORT_PAGE_SIZE);
    if (rows.length === 0) break;
    yield (wrote ? "\n\n" : "") + rows.map((row) => row.pgn.trim()).join("\n\n");
    wrote = true;
    if (rows.length < EXPORT_PAGE_SIZE) break;
    after = rows[rows.length - 1]!.id;
  }
  if (wrote) yield "\n";
}
