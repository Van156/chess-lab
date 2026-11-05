import { createHash } from "node:crypto";
import { EXPLORER_MOVES, LICHESS_BASE_URL, LICHESS_EXPLORER_URL, MAX_429_RETRIES } from "./config";
import { parseNdjson } from "./ndjson";
import { createSerialGate } from "./serial-gate";
import {
  LichessHttpError,
  LichessProtocolError,
  LichessRateLimited,
  LichessUnauthorized,
} from "./types";
import type {
  ExplorerArgs,
  ExplorerStats,
  ExportGamesArgs,
  LichessAccount,
  LichessClient,
  LichessClientDeps,
  LichessGame,
} from "./types";

/** Every non-correspondence perf: correspondence games are excluded from the import (R3). */
const EXPORT_PERF_TYPES = "ultraBullet,bullet,blitz,rapid,classical";

const NDJSON = "application/x-ndjson";
const JSON_ACCEPT = "application/json";

/** The gate key: one slot per Lichess user, without keeping the raw token as a map key. */
function gateKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function* readChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function isGame(value: unknown): value is LichessGame {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.pgn === "string";
}

export function createLichessClient(deps: LichessClientDeps): LichessClient {
  const baseUrl = deps.baseUrl ?? LICHESS_BASE_URL;
  const explorerUrl = deps.explorerUrl ?? LICHESS_EXPLORER_URL;
  const gate = createSerialGate({ now: deps.now, sleep: deps.sleep });

  /**
   * Sends one request. The caller must hold the user's gate slot. A 429 pauses
   * the user's gate (60 s doubling up to 5 min) and retries up to
   * `MAX_429_RETRIES` times before failing with `LichessRateLimited`. With `failFast` a
   * 429 still pauses the gate but fails at once without sleeping or retrying.
   */
  async function send(
    key: string,
    url: URL,
    token: string,
    accept: string,
    signal?: AbortSignal,
    failFast = false,
  ): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      signal?.throwIfAborted();
      const response = await deps.fetch(url, {
        headers: { accept, authorization: `Bearer ${token}` },
        signal,
      });

      if (response.status === 429) {
        await response.body?.cancel().catch(() => {});
        const retryAt = gate.backoff(key);
        if (failFast || attempt >= MAX_429_RETRIES) throw new LichessRateLimited(retryAt);
        await gate.waitClear(key);
        continue;
      }
      if (response.status === 401) throw new LichessUnauthorized();
      if (!response.ok) throw new LichessHttpError(response.status);

      gate.reset(key);
      return response;
    }
  }

  /**
   * One JSON request through the user's gate slot. `failFast` is for interactive callers: a
   * paused gate throws `LichessRateLimited` at once, and a 429 is not slept through.
   */
  async function getJson<T>(url: URL, token: string, failFast = false): Promise<T> {
    const key = gateKey(token);
    return gate.run(
      key,
      async () => {
        const response = await send(key, url, token, JSON_ACCEPT, undefined, failFast);
        return (await response.json()) as T;
      },
      { failIfPaused: failFast },
    );
  }

  async function* exportGames(args: ExportGamesArgs): AsyncGenerator<LichessGame> {
    const url = new URL(`/api/games/user/${encodeURIComponent(args.username)}`, baseUrl);
    url.search = new URLSearchParams({
      since: String(args.sinceMs),
      sort: "dateAsc",
      clocks: "true",
      opening: "true",
      pgnInJson: "true",
      moves: "true",
      evals: "false",
      finished: "true",
      perfType: EXPORT_PERF_TYPES,
      ...(args.max === undefined ? {} : { max: String(args.max) }),
    }).toString();

    const key = gateKey(args.token);
    const release = await gate.acquire(key);
    try {
      const response = await send(key, url, args.token, NDJSON, args.signal);
      if (!response.body) throw new LichessProtocolError("Lichess export had no body");

      for await (const record of parseNdjson(readChunks(response.body))) {
        args.signal.throwIfAborted();
        if (!isGame(record)) throw new LichessProtocolError("Export record is not a game");
        if (record.variant !== "standard" || record.speed === "correspondence") continue;
        yield record;
      }
      args.signal.throwIfAborted();
    } finally {
      release();
    }
  }

  return {
    account: (token: string) => getJson<LichessAccount>(new URL("/api/account", baseUrl), token),

    exportGames,

    explorer: (args: ExplorerArgs) => {
      const url = new URL(explorerUrl);
      url.searchParams.set("fen", args.fen);
      url.searchParams.set("ratings", args.ratings.join(","));
      url.searchParams.set("speeds", args.speeds.join(","));
      url.searchParams.set("moves", String(EXPLORER_MOVES));
      url.searchParams.set("topGames", "0");
      url.searchParams.set("recentGames", "0");
      return getJson<ExplorerStats>(url, args.token, true);
    },
  };
}
