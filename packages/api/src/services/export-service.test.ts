import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import * as schema from "@b2c-template/db/schema";
import { account, session, user } from "@b2c-template/db/schema/auth";
import { card, reviewLog } from "@b2c-template/db/schema/cards";
import { game, gameAnalysis, mistake } from "@b2c-template/db/schema/games";
import { lichessProfile } from "@b2c-template/db/schema/lichess";
import {
  ideaNote,
  repertoire,
  repertoireMove,
  repertoirePosition,
} from "@b2c-template/db/schema/repertoire";
import { userSettings } from "@b2c-template/db/schema/settings";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { getColumns, getTableName, isTable } from "drizzle-orm";

import { EXPORT_JSON_SECTIONS, exportUserJson, exportUserPgn } from "./export-service";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "export service");

/**
 * Tables with a `user_id` column that the export deliberately leaves out. Each needs a reason:
 * anything else must be a section of `exportUserJson` (FR-19), so a later phase cannot forget it.
 */
const EXCLUDED_TABLES: Record<string, string> = {
  session: "Session tokens, IP addresses and user agents are credentials, not the user's data.",
  account:
    "Holds the encrypted Lichess token, refresh and id tokens and password hashes; the username is exported through lichessProfile.",
};

const PGN = "1. e4 e5 2. Nf3 Nc6 *";

async function collect(chunks: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const chunk of chunks) out += chunk;
  return out;
}

describe.skipIf(!reachable)("export service", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });
  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: `name-${id}`, email: `${id}@example.test` });
    }
  });

  async function seedGames(userId: string, count: number, prefix = "g") {
    const rows = Array.from({ length: count }, (_, i) => ({
      userId,
      lichessGameId: `${prefix}${i}`,
      pgn: `[Event "${prefix}${i}"]\n\n${PGN}\n`,
      userColor: "white" as const,
      speed: "blitz",
      rated: true,
      result: "*" as const,
      playedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
    }));
    const inserted: { id: string }[] = [];
    for (let i = 0; i < rows.length; i += 500) {
      inserted.push(
        ...(await handle.db
          .insert(game)
          .values(rows.slice(i, i + 500))
          .returning({ id: game.id })),
      );
    }
    return inserted;
  }

  /** One of everything for `userId`, with secrets planted in the tables the export must skip. */
  async function seedEverything(userId: string) {
    const [g] = await seedGames(userId, 1, `${userId}-seed-`);
    await handle.db.insert(gameAnalysis).values({ gameId: g!.id, userId, status: "complete" });
    const [m] = await handle.db
      .insert(mistake)
      .values({
        userId,
        gameId: g!.id,
        ply: 3,
        fenBefore: "fen",
        positionKey: "key",
        playedSan: "h3",
        playedUci: "h2h3",
        bestSan: "Nf3",
        bestUci: "g1f3",
        evalBeforeCp: 30,
        evalAfterCp: -400,
        evalLossCp: 430,
        severity: "blunder",
        phase: "opening",
      })
      .returning();
    const [c] = await handle.db
      .insert(card)
      .values({ userId, mistakeId: m!.id, due: new Date("2026-03-11T00:00:00.000Z") })
      .returning();
    await handle.db.insert(reviewLog).values({
      id: `${userId}-log`,
      userId,
      cardId: c!.id,
      grade: 3,
      reviewedAt: new Date("2026-03-10T00:00:00.000Z"),
      elapsedMs: 1200,
      stateBefore: { state: 0 },
      stateAfter: { state: 1 },
    });
    const [rep] = await handle.db
      .insert(repertoire)
      .values({ userId, color: "white", name: `Repertoire ${userId}` })
      .returning();
    const [start, afterE4] = await handle.db
      .insert(repertoirePosition)
      .values([
        { repertoireId: rep!.id, userId, positionKey: "start", fen: "start-fen", sideToMove: "w" },
        { repertoireId: rep!.id, userId, positionKey: "e4", fen: "e4-fen", sideToMove: "b" },
      ])
      .returning();
    await handle.db.insert(repertoireMove).values({
      repertoireId: rep!.id,
      userId,
      fromPositionId: start!.id,
      toPositionId: afterE4!.id,
      san: "e4",
      uci: "e2e4",
    });
    await handle.db
      .insert(ideaNote)
      .values({ repertoirePositionId: afterE4!.id, userId, plan: `Plan ${userId}` });
    await handle.db.insert(userSettings).values({ userId, timeZone: "Europe/Madrid" });
    await handle.db.insert(lichessProfile).values({
      userId,
      lichessId: `lichess-${userId}`,
      username: `Name${userId}`,
      ratingSnapshot: { blitz: 1800 },
      importCursorMs: 1000,
      importLeaseUntil: new Date("2026-03-10T12:00:00.000Z"),
    });
    await handle.db.insert(account).values({
      id: `${userId}-acc`,
      accountId: `lichess-${userId}`,
      providerId: "lichess",
      userId,
      accessToken: "SECRET-ACCESS-TOKEN",
      refreshToken: "SECRET-REFRESH-TOKEN",
      idToken: "SECRET-ID-TOKEN",
      password: "SECRET-PASSWORD-HASH",
    });
    await handle.db.insert(session).values({
      id: `${userId}-sess`,
      token: `SECRET-SESSION-TOKEN-${userId}`,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      userId,
    });
  }

  test("contains every section and no secrets, lease fields or tokens", async () => {
    await seedEverything("u1");
    const text = await collect(exportUserJson(handle.db, "u1"));
    const data = JSON.parse(text);

    expect(Object.keys(data).sort()).toEqual(
      [
        "user",
        "settings",
        "lichessProfile",
        "games",
        "analyses",
        "mistakes",
        "cards",
        "reviewLogs",
        "repertoires",
        "repertoirePositions",
        "repertoireMoves",
        "ideaNotes",
      ].sort(),
    );
    expect(data.user).toMatchObject({ id: "u1", name: "name-u1", lichessUsername: "Nameu1" });
    expect(data.settings).toMatchObject({ userId: "u1", timeZone: "Europe/Madrid" });
    expect(data.lichessProfile).toMatchObject({ username: "Nameu1", importCursorMs: 1000 });
    expect(data.lichessProfile).not.toHaveProperty("importLeaseUntil");
    expect(data.games).toHaveLength(1);
    expect(data.analyses).toHaveLength(1);
    expect(data.mistakes).toHaveLength(1);
    expect(data.cards).toHaveLength(1);
    expect(data.reviewLogs).toHaveLength(1);
    expect(data.repertoires).toHaveLength(1);
    expect(data.repertoires[0]).toMatchObject({ userId: "u1", name: "Repertoire u1" });
    expect(data.repertoirePositions).toHaveLength(2);
    expect(data.repertoireMoves).toHaveLength(1);
    expect(data.repertoireMoves[0]).toMatchObject({ userId: "u1", san: "e4", uci: "e2e4" });
    expect(data.ideaNotes).toHaveLength(1);
    expect(data.ideaNotes[0]).toMatchObject({ userId: "u1", plan: "Plan u1" });

    for (const secret of ["SECRET", "accessToken", "refreshToken", "idToken", "password"]) {
      expect(text).not.toContain(secret);
    }
  });

  test("an empty account yields valid empty sections", async () => {
    const data = JSON.parse(await collect(exportUserJson(handle.db, "u1")));
    expect(data.games).toEqual([]);
    expect(data.settings).toBeNull();
    expect(data.lichessProfile).toBeNull();
    expect(data.user.lichessUsername).toBeNull();
    expect(await collect(exportUserPgn(handle.db, "u1"))).toBe("");
  });

  test("pages of 500 produce one valid JSON document for more than 1000 rows", async () => {
    await seedGames("u1", 1201);
    const chunks: string[] = [];
    for await (const chunk of exportUserJson(handle.db, "u1")) chunks.push(chunk);
    expect(chunks.length).toBeGreaterThan(3);
    const data = JSON.parse(chunks.join(""));
    expect(data.games).toHaveLength(1201);
    expect(new Set(data.games.map((g: { id: string }) => g.id)).size).toBe(1201);
  });

  test("only the caller's rows are exported", async () => {
    await seedEverything("u1");
    await seedEverything("u2");
    const text = await collect(exportUserJson(handle.db, "u1"));
    expect(text).not.toContain("u2");
    expect(text).not.toContain("Nameu2");
    const pgn = await collect(exportUserPgn(handle.db, "u1"));
    expect(pgn).not.toContain("u2-seed");
  });

  test("exportUserPgn streams all games separated by blank lines", async () => {
    await seedGames("u1", 1001);
    await seedGames("u2", 3, "other");
    const pgn = await collect(exportUserPgn(handle.db, "u1"));
    // Each game is "[Event]\n\nmoves *"; consecutive games are separated by exactly one blank line.
    expect(pgn.split(/\*\n\n(?=\[Event)/)).toHaveLength(1001);
    expect(pgn).not.toContain("\n\n\n");
    expect(pgn.match(/\[Event "g\d+"\]/g)).toHaveLength(1001);
    expect(pgn).not.toContain("other");
    expect(pgn.endsWith("\n")).toBe(true);
  });

  test("every table with a user_id column is exported or explicitly excluded", async () => {
    const userScoped = (Object.values(schema) as unknown[])
      .filter(isTable)
      .filter((table) =>
        Object.values(getColumns(table)).some((column) => column.name === "user_id"),
      )
      .map((table) => getTableName(table));
    expect(userScoped.length).toBeGreaterThan(5);

    const covered = new Set<string>(Object.values(EXPORT_JSON_SECTIONS));
    const missing = userScoped.filter((name) => !covered.has(name) && !(name in EXCLUDED_TABLES));
    expect(missing).toEqual([]);

    // Exclusions must name real tables and never overlap a section.
    for (const name of Object.keys(EXCLUDED_TABLES)) {
      expect(userScoped).toContain(name);
      expect(covered.has(name)).toBe(false);
    }

    // The declared sections are what the export actually writes.
    await seedEverything("u1");
    const data = JSON.parse(await collect(exportUserJson(handle.db, "u1")));
    for (const section of Object.keys(EXPORT_JSON_SECTIONS)) {
      expect(data).toHaveProperty(section);
    }
  });
});
