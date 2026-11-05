import {
  EXPLORER_CACHE_TTL_MS,
  EXPLORER_STALE_MAX_MS,
  EXPLORER_WAIT_MS,
  LichessHttpError,
  LichessRateLimited,
  LichessUnauthorized,
} from "@b2c-template/lichess";
import type {
  ExplorerArgs,
  ExplorerStats,
  ExportGamesArgs,
  LichessClient,
  LichessGame,
} from "@b2c-template/lichess";
import { describe, expect, test } from "bun:test";

import { createExplorerCache } from "./explorer-cache";
import { createExplorerPort, createGamesSource, createLichessPort } from "./lichess-port";

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
  return Object.assign(new Error(code), {
    name: "APIError",
    body: { code, message: code },
  });
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
    expect(calls[0]).toMatchObject({
      username: "Alice",
      sinceMs: 1000,
      max: 5,
    });
    expect(calls[0]?.token).toBe("token-for-u1");
    expect("userId" in (calls[0] as object)).toBe(false);
  });
});

describe("createLichessPort", () => {
  test("delegates status to the service and sync to the runner", async () => {
    const status = {
      state: "idle",
      lastSyncedAt: null,
      retryAt: null,
      gamesImported: 0,
    } as const;
    const port = createLichessPort(
      {
        status: async (userId) => ({
          ...status,
          gamesImported: userId === "u1" ? 7 : 0,
        }),
      },
      { start: async () => ({ ...status, state: "running" }) },
      async () => ({ status: "unavailable", reason: "error" }),
    );
    expect((await port.status("u1")).gamesImported).toBe(7);
    expect((await port.requestSync("u1")).state).toBe("running");
  });
});

const query = {
  positionKey: "pos-1",
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  band: 1600,
  speeds: ["blitz", "rapid", "classical"],
} as const;

const stats: ExplorerStats = { white: 5, draws: 3, black: 2, moves: [] };
const freshStats: ExplorerStats = { white: 9, draws: 1, black: 1, moves: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function explorerSetup(
  options: {
    token?: string | null | Error;
    tokenFor?: (userId: string) => string;
    cache?: ReturnType<typeof createExplorerCache<ExplorerStats>>;
  } = {},
) {
  const calls: ExplorerArgs[] = [];
  let respond: (args: ExplorerArgs) => Promise<ExplorerStats> = async () => stats;
  const client = {
    explorer(args: ExplorerArgs) {
      calls.push(args);
      return respond(args);
    },
  } as unknown as LichessClient;
  const clock = { now: 1_000_000 };
  const cache =
    options.cache ??
    createExplorerCache<ExplorerStats>({
      ttlMs: EXPLORER_CACHE_TTL_MS,
      staleMaxMs: EXPLORER_STALE_MAX_MS,
      maxEntries: 10,
      now: () => clock.now,
    });
  const timers: { fire: () => void; ms: number; cleared: boolean }[] = [];
  const resolveToken = async (userId: string) => {
    if (options.tokenFor) return options.tokenFor(userId);
    const token = options.token === undefined ? "secret-token" : options.token;
    if (token instanceof Error) throw token;
    return token;
  };
  const explorer = createExplorerPort({
    client,
    resolveToken,
    cache,
    setTimer: (fire, ms) => {
      const timer = { fire, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      (handle as { cleared: boolean }).cleared = true;
    },
  });
  return {
    explorer,
    calls,
    clock,
    timers,
    setResponder(next: (args: ExplorerArgs) => Promise<ExplorerStats>) {
      respond = next;
    },
  };
}

describe("createExplorerPort", () => {
  test("an ok answer comes from one client call with the band, speeds, fen and token", async () => {
    const { explorer, calls } = explorerSetup();
    const result = await explorer("u1", query);
    expect(result).toEqual({ status: "ok", stats, stale: false });
    expect(calls).toEqual([
      {
        fen: query.fen,
        ratings: [1600],
        speeds: [...query.speeds],
        token: "secret-token",
      },
    ]);
  });

  test("the token never appears in the result", async () => {
    const { explorer, setResponder } = explorerSetup();
    expect(JSON.stringify(await explorer("u1", query))).not.toContain("secret-token");
    setResponder(async () => {
      throw new LichessHttpError(500);
    });
    const failed = await explorer("u1", { ...query, positionKey: "other" });
    expect(JSON.stringify(failed)).not.toContain("secret-token");
  });

  test("a second identical query is a cache hit without a client call", async () => {
    const { explorer, calls } = explorerSetup();
    await explorer("u1", query);
    expect(await explorer("u2", query)).toEqual({
      status: "ok",
      stats,
      stale: false,
    });
    expect(calls).toHaveLength(1);
  });

  test("a different band or speeds is a different cache entry", async () => {
    const { explorer, calls } = explorerSetup();
    await explorer("u1", query);
    await explorer("u1", { ...query, band: 1800 });
    await explorer("u1", { ...query, speeds: ["blitz"] });
    expect(calls).toHaveLength(3);
  });

  test("a null token is unauthorized and the client is not called", async () => {
    const { explorer, calls } = explorerSetup({ token: null });
    expect(await explorer("u1", query)).toEqual({
      status: "unavailable",
      reason: "unauthorized",
    });
    expect(calls).toHaveLength(0);
  });

  test.each(["ACCOUNT_NOT_FOUND", "FAILED_TO_GET_ACCESS_TOKEN", "REFRESH_TOKEN_NOT_FOUND"])(
    "the better-auth %s error is unauthorized and the client is not called",
    async (code) => {
      const { explorer, calls } = explorerSetup({
        token: betterAuthError(code),
      });
      expect(await explorer("u1", query)).toEqual({
        status: "unavailable",
        reason: "unauthorized",
      });
      expect(calls).toHaveLength(0);
    },
  );

  test("an unauthorized user gets no cached data even when the position is cached", async () => {
    const cache = createExplorerCache<ExplorerStats>({
      ttlMs: EXPLORER_CACHE_TTL_MS,
      staleMaxMs: EXPLORER_STALE_MAX_MS,
      maxEntries: 10,
      now: () => 1_000_000,
    });
    const warm = explorerSetup({ cache });
    const unlinked = explorerSetup({ cache, token: null });
    await warm.explorer("u1", query);
    // The shared cache is warm: a second identical query is served without a client call.
    expect(await warm.explorer("u1", query)).toEqual({
      status: "ok",
      stats,
      stale: false,
    });
    expect(warm.calls).toHaveLength(1);

    expect(await unlinked.explorer("u2", query)).toEqual({
      status: "unavailable",
      reason: "unauthorized",
    });
    expect(unlinked.calls).toHaveLength(0);
  });

  test("a failure on one user's in-flight load does not reach another user's request", async () => {
    const { explorer, calls, setResponder } = explorerSetup({
      tokenFor: (userId) => `token-${userId}`,
    });
    const gateA = deferred<ExplorerStats>();
    const gateB = deferred<ExplorerStats>();
    setResponder((args) => (args.token === "token-uA" ? gateA.promise : gateB.promise));
    const a = explorer("uA", query);
    const b = explorer("uB", query);
    // Let both requests pass the token lookup and reach the cache.
    await Promise.resolve();
    await Promise.resolve();
    gateA.reject(new LichessUnauthorized());
    // Settle A before B stores its answer, so A cannot fall back to B's stored stats.
    expect(await a).toEqual({ status: "unavailable", reason: "unauthorized" });
    gateB.resolve(stats);
    expect(await b).toEqual({ status: "ok", stats, stale: false });
    expect(calls.map((call) => call.token).sort()).toEqual(["token-uA", "token-uB"]);
  });

  test("concurrent identical queries from one user share one client call", async () => {
    const { explorer, calls, setResponder } = explorerSetup();
    const gate = deferred<ExplorerStats>();
    setResponder(() => gate.promise);
    const results = Promise.all([explorer("u1", query), explorer("u1", query)]);
    gate.resolve(stats);
    expect(await results).toEqual([
      { status: "ok", stats, stale: false },
      { status: "ok", stats, stale: false },
    ]);
    expect(calls).toHaveLength(1);
  });

  test("any other resolver error is reported as an error", async () => {
    const { explorer, calls } = explorerSetup({ token: new Error("db down") });
    expect(await explorer("u1", query)).toEqual({
      status: "unavailable",
      reason: "error",
    });
    expect(calls).toHaveLength(0);
  });

  test("a 401 from Lichess is unauthorized", async () => {
    const { explorer, setResponder } = explorerSetup();
    setResponder(async () => {
      throw new LichessUnauthorized();
    });
    expect(await explorer("u1", query)).toEqual({
      status: "unavailable",
      reason: "unauthorized",
    });
  });

  test("a 429 with no cached entry is rate_limited", async () => {
    const { explorer, setResponder } = explorerSetup();
    setResponder(async () => {
      throw new LichessRateLimited(2_000_000);
    });
    expect(await explorer("u1", query)).toEqual({
      status: "unavailable",
      reason: "rate_limited",
    });
  });

  test("a 429 after an expired entry serves it as stale", async () => {
    const { explorer, setResponder, clock } = explorerSetup();
    await explorer("u1", query);
    clock.now += EXPLORER_CACHE_TTL_MS + 1;
    setResponder(async () => {
      throw new LichessRateLimited(clock.now + 60_000);
    });
    expect(await explorer("u1", query)).toEqual({
      status: "ok",
      stats,
      stale: true,
    });
  });

  test("a 429 after an entry older than the stale limit is rate_limited", async () => {
    const { explorer, setResponder, clock } = explorerSetup();
    await explorer("u1", query);
    clock.now += EXPLORER_STALE_MAX_MS + 1;
    setResponder(async () => {
      throw new LichessRateLimited(clock.now + 60_000);
    });
    expect(await explorer("u1", query)).toEqual({
      status: "unavailable",
      reason: "rate_limited",
    });
  });

  test("a generic error is an error without a stale entry and stale with one", async () => {
    const { explorer, setResponder, clock } = explorerSetup();
    setResponder(async () => {
      throw new LichessHttpError(500);
    });
    expect(await explorer("u1", query)).toEqual({
      status: "unavailable",
      reason: "error",
    });
    setResponder(async () => stats);
    await explorer("u1", query);
    clock.now += EXPLORER_CACHE_TTL_MS + 1;
    setResponder(async () => {
      throw new LichessHttpError(500);
    });
    expect(await explorer("u1", query)).toEqual({
      status: "ok",
      stats,
      stale: true,
    });
  });

  test("waits at most EXPLORER_WAIT_MS", async () => {
    const { explorer, timers, setResponder } = explorerSetup();
    setResponder(() => new Promise(() => {}));
    const pending = explorer("u1", query);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(timers.map((t) => t.ms)).toEqual([EXPLORER_WAIT_MS]);
    timers[0]?.fire();
    expect(await pending).toEqual({ status: "unavailable", reason: "timeout" });
  });

  test("the deadline serves a stale entry while the load is still running", async () => {
    const { explorer, timers, setResponder, clock } = explorerSetup();
    await explorer("u1", query);
    clock.now += EXPLORER_CACHE_TTL_MS + 1;
    setResponder(() => new Promise(() => {}));
    const pending = explorer("u1", query);
    await new Promise((r) => setTimeout(r, 0));
    timers[timers.length - 1]?.fire();
    expect(await pending).toEqual({ status: "ok", stats, stale: true });
  });

  test("after a deadline the background load fills the cache for the next request", async () => {
    const { explorer, timers, calls, setResponder } = explorerSetup();
    const load = deferred<ExplorerStats>();
    setResponder(() => load.promise);
    const pending = explorer("u1", query);
    await new Promise((r) => setTimeout(r, 0));
    timers[0]?.fire();
    expect(await pending).toEqual({ status: "unavailable", reason: "timeout" });
    load.resolve(freshStats);
    await new Promise((r) => setTimeout(r, 0));
    expect(await explorer("u1", query)).toEqual({
      status: "ok",
      stats: freshStats,
      stale: false,
    });
    expect(calls).toHaveLength(1);
  });

  test("a background load that fails after the deadline is swallowed", async () => {
    const { explorer, timers, setResponder } = explorerSetup();
    const load = deferred<ExplorerStats>();
    setResponder(() => load.promise);
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const pending = explorer("u1", query);
      await new Promise((r) => setTimeout(r, 0));
      timers[0]?.fire();
      await pending;
      load.reject(new LichessHttpError(500));
      await new Promise((r) => setTimeout(r, 10));
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
    expect(unhandled).toEqual([]);
  });

  test("the deadline timer is cleared when the answer arrives first", async () => {
    const { explorer, timers } = explorerSetup();
    await explorer("u1", query);
    expect(timers.every((t) => t.cleared)).toBe(true);
  });
});
