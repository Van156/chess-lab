import { LichessUnauthorized } from "@b2c-template/lichess";
import type { ExportGamesArgs, LichessClient, LichessGame } from "@b2c-template/lichess";
import { describe, expect, test } from "bun:test";

import { createGamesSource, createLichessPort } from "./lichess-port";

function fakeClient(games: LichessGame[] = []) {
  const calls: ExportGamesArgs[] = [];
  const client = {
    exportGames(args: ExportGamesArgs) {
      calls.push(args);
      return (async function* () {
        yield* games;
      })();
    },
  } as unknown as LichessClient;
  return { client, calls };
}

const request = {
  userId: "u1",
  username: "Alice",
  sinceMs: 1000,
  signal: new AbortController().signal,
};

/** Mirrors the shape of better-auth's `APIError`: a named error carrying `body.code`. */
function betterAuthError(code: string) {
  return Object.assign(new Error(code), { name: "APIError", body: { code, message: code } });
}

async function drain(source: AsyncIterable<LichessGame>) {
  for await (const _ of source) {
    // exhaust
  }
}

describe("createGamesSource", () => {
  test("a missing token fails with LichessUnauthorized before calling Lichess", async () => {
    const { client, calls } = fakeClient();
    const source = createGamesSource(client, async () => null);
    await expect(drain(source.exportGames(request))).rejects.toBeInstanceOf(LichessUnauthorized);
    expect(calls).toHaveLength(0);
  });

  test.each(["ACCOUNT_NOT_FOUND", "FAILED_TO_GET_ACCESS_TOKEN", "REFRESH_TOKEN_NOT_FOUND"])(
    "the better-auth %s error maps to LichessUnauthorized",
    async (code) => {
      const { client, calls } = fakeClient();
      const source = createGamesSource(client, async () => {
        throw betterAuthError(code);
      });
      await expect(drain(source.exportGames(request))).rejects.toBeInstanceOf(LichessUnauthorized);
      expect(calls).toHaveLength(0);
    },
  );

  test("any other resolver failure is rethrown unchanged so the import is retryable", async () => {
    const { client, calls } = fakeClient();
    const failures = [
      new Error("connection terminated unexpectedly"),
      new DOMException("The operation was aborted", "AbortError"),
      betterAuthError("INTERNAL_SERVER_ERROR"),
    ];
    for (const failure of failures) {
      const source = createGamesSource(client, async () => {
        throw failure;
      });
      await expect(drain(source.exportGames(request))).rejects.toBe(failure);
    }
    expect(calls).toHaveLength(0);
  });

  test("passes the token but not the user id to the client", async () => {
    const { client, calls } = fakeClient();
    const source = createGamesSource(client, async (userId) => `token-for-${userId}`);
    await drain(source.exportGames({ ...request, max: 5 }));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ username: "Alice", sinceMs: 1000, max: 5 });
    expect(calls[0]?.token).toBe("token-for-u1");
    expect("userId" in (calls[0] as object)).toBe(false);
  });
});

describe("createLichessPort", () => {
  test("delegates status to the service and sync to the runner", async () => {
    const status = { state: "idle", lastSyncedAt: null, retryAt: null, gamesImported: 0 } as const;
    const port = createLichessPort(
      { status: async (userId) => ({ ...status, gamesImported: userId === "u1" ? 7 : 0 }) },
      { start: async () => ({ ...status, state: "running" }) },
    );
    expect((await port.status("u1")).gamesImported).toBe(7);
    expect((await port.requestSync("u1")).state).toBe("running");
  });
});
