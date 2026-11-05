import { describe, expect, test } from "bun:test";
import { createLichessClient } from "./client";
import { EXPLORER_MOVES } from "./config";
import { LichessHttpError, LichessRateLimited, LichessUnauthorized } from "./types";
import type { LichessGame } from "./types";

const enc = new TextEncoder();
const NOW = 1_700_000_000_000;

type Call = { url: URL; init: RequestInit };
type Responder = (call: Call, index: number) => Response | Promise<Response>;

function setup(respond: Responder) {
  const calls: Call[] = [];
  const clock = { now: NOW, sleeps: [] as number[] };
  const fakeFetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: new URL(String(input)), init };
    calls.push(call);
    return respond(call, calls.length - 1);
  }) as unknown as typeof fetch;
  const client = createLichessClient({
    fetch: fakeFetch,
    now: () => clock.now,
    sleep: async (ms) => {
      clock.sleeps.push(ms);
      clock.now += ms;
    },
  });
  return { client, calls, clock };
}

function game(id: string, overrides: Partial<LichessGame> = {}): LichessGame {
  return {
    id,
    rated: true,
    variant: "standard",
    speed: "blitz",
    status: "mate",
    createdAt: NOW,
    winner: "white",
    players: { white: { user: { id: "me", name: "Me" } }, black: {} },
    pgn: "1. e4 e5 *",
    ...overrides,
  };
}

function ndjsonResponse(records: unknown[], chunkSize = 40) {
  const bytes = enc.encode(records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/x-ndjson" },
  });
}

async function collect(source: AsyncIterable<LichessGame>) {
  const out: LichessGame[] = [];
  for await (const g of source) out.push(g);
  return out;
}

const exportArgs = (signal = new AbortController().signal) => ({
  username: "Me",
  token: "tok",
  sinceMs: 1234,
  signal,
});

/** The client sends a plain header record. */
function header(headers: RequestInit["headers"], name: string) {
  return (headers as Record<string, string>)[name];
}

const accountOk = () => Response.json({ id: "me", username: "Me" });

describe("account", () => {
  test("sends the bearer token and returns the account", async () => {
    const { client, calls } = setup(accountOk);
    expect(await client.account("tok")).toEqual({ id: "me", username: "Me" });
    expect(calls[0]?.url.href).toBe("https://lichess.org/api/account");
    expect(header(calls[0]?.init.headers, "authorization")).toBe("Bearer tok");
  });

  test("maps 401 to LichessUnauthorized", async () => {
    const { client } = setup(() => new Response("", { status: 401 }));
    await expect(client.account("tok")).rejects.toBeInstanceOf(LichessUnauthorized);
  });

  test("maps other failures to LichessHttpError", async () => {
    const { client } = setup(() => new Response("", { status: 500 }));
    await expect(client.account("tok")).rejects.toBeInstanceOf(LichessHttpError);
    await expect(client.account("tok")).rejects.toMatchObject({ status: 500 });
  });
});

describe("exportGames", () => {
  test("requests the export with the documented parameters and headers", async () => {
    const { client, calls } = setup(() => ndjsonResponse([]));
    await collect(client.exportGames({ ...exportArgs(), max: 50 }));

    const { url, init } = calls[0]!;
    expect(url.origin + url.pathname).toBe("https://lichess.org/api/games/user/Me");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      since: "1234",
      sort: "dateAsc",
      clocks: "true",
      opening: "true",
      pgnInJson: "true",
      moves: "true",
      evals: "false",
      finished: "true",
      perfType: "ultraBullet,bullet,blitz,rapid,classical",
      max: "50",
    });
    expect(header(init.headers, "accept")).toBe("application/x-ndjson");
    expect(header(init.headers, "authorization")).toBe("Bearer tok");
  });

  test("omits max when not given", async () => {
    const { client, calls } = setup(() => ndjsonResponse([]));
    await collect(client.exportGames(exportArgs()));
    expect(calls[0]?.url.searchParams.has("max")).toBe(false);
  });

  test("yields games across chunk boundaries", async () => {
    const { client } = setup(() => ndjsonResponse([game("a"), game("b")], 17));
    const games = await collect(client.exportGames(exportArgs()));
    expect(games.map((g) => g.id)).toEqual(["a", "b"]);
  });

  test("skips correspondence records even if the server returns them", async () => {
    const { client } = setup(() =>
      ndjsonResponse([game("a"), game("b", { speed: "correspondence" }), game("c")]),
    );
    const games = await collect(client.exportGames(exportArgs()));
    expect(games.map((g) => g.id)).toEqual(["a", "c"]);
  });

  test("skips non-standard variants", async () => {
    const { client } = setup(() =>
      ndjsonResponse([game("a"), game("b", { variant: "chess960" }), game("c")]),
    );
    const games = await collect(client.exportGames(exportArgs()));
    expect(games.map((g) => g.id)).toEqual(["a", "c"]);
  });

  test("rejects a record without an id or pgn", async () => {
    const { client } = setup(() => ndjsonResponse([{ variant: "standard" }]));
    await expect(collect(client.exportGames(exportArgs()))).rejects.toThrow(/game/i);
  });

  test("maps 401 to LichessUnauthorized", async () => {
    const { client } = setup(() => new Response("", { status: 401 }));
    await expect(collect(client.exportGames(exportArgs()))).rejects.toBeInstanceOf(
      LichessUnauthorized,
    );
  });

  test("on 429 pauses a minute, retries, then streams the games", async () => {
    const { client, calls, clock } = setup((_, i) =>
      i === 0 ? new Response("", { status: 429 }) : ndjsonResponse([game("a")]),
    );
    const games = await collect(client.exportGames(exportArgs()));
    expect(games.map((g) => g.id)).toEqual(["a"]);
    expect(calls).toHaveLength(2);
    expect(clock.sleeps).toEqual([60_000]);
  });

  test("doubles the pause across consecutive 429s", async () => {
    const { client, calls, clock } = setup((_, i) =>
      i < 3 ? new Response("", { status: 429 }) : ndjsonResponse([game("a")]),
    );
    await collect(client.exportGames(exportArgs()));
    expect(calls).toHaveLength(4);
    expect(clock.sleeps).toEqual([60_000, 120_000, 240_000]);
  });

  test("throws LichessRateLimited with retryAt after MAX_429_RETRIES retries", async () => {
    const { client, calls, clock } = setup(() => new Response("", { status: 429 }));
    const error = await collect(client.exportGames(exportArgs())).catch((e) => e);

    expect(error).toBeInstanceOf(LichessRateLimited);
    expect(calls).toHaveLength(4);
    expect(clock.sleeps).toEqual([60_000, 120_000, 240_000]);
    expect(error.retryAt).toBe(clock.now + 300_000);
  });

  test("keeps the pause for the next request of the same user after giving up", async () => {
    let failing = true;
    const { client, clock } = setup(() =>
      failing ? new Response("", { status: 429 }) : accountOk(),
    );
    await collect(client.exportGames(exportArgs())).catch(() => {});
    failing = false;
    const sleepsBefore = clock.sleeps.length;
    await client.account("tok");
    expect(clock.sleeps.slice(sleepsBefore)).toEqual([300_000]);
  });

  test("a clean response resets the doubling", async () => {
    let n = 0;
    const { client, clock } = setup(() => {
      n += 1;
      return n === 1 || n === 3 ? new Response("", { status: 429 }) : accountOk();
    });
    await client.account("tok");
    await client.account("tok");
    expect(clock.sleeps).toEqual([60_000, 60_000]);
  });

  test("never runs two requests for the same token at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const { client } = setup(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return accountOk();
    });
    await Promise.all([client.account("tok"), client.account("tok"), client.account("tok")]);
    expect(peak).toBe(1);
  });

  test("passes the abort signal to fetch", async () => {
    const controller = new AbortController();
    const { client, calls } = setup(() => ndjsonResponse([]));
    await collect(client.exportGames(exportArgs(controller.signal)));
    expect(calls[0]?.init.signal).toBe(controller.signal);
  });

  test("stops mid-stream when aborted", async () => {
    const controller = new AbortController();
    const { client } = setup(() => ndjsonResponse([game("a"), game("b"), game("c")], 1024));
    const seen: string[] = [];
    const run = (async () => {
      for await (const g of client.exportGames(exportArgs(controller.signal))) {
        seen.push(g.id);
        controller.abort();
      }
    })();
    await expect(run).rejects.toThrow();
    expect(seen).toEqual(["a"]);
  });

  test("releases the gate when the consumer stops early", async () => {
    const { client } = setup((_, i) =>
      i === 0 ? ndjsonResponse([game("a"), game("b")]) : accountOk(),
    );
    for await (const _ of client.exportGames(exportArgs())) break;
    expect(await client.account("tok")).toEqual({ id: "me", username: "Me" });
  });
});

describe("explorer", () => {
  test("always sends the user's token and the query", async () => {
    const stats = { white: 1, draws: 0, black: 0, moves: [] };
    const { client, calls } = setup(() => Response.json(stats));
    const result = await client.explorer({
      fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      ratings: [1600, 1800],
      speeds: ["blitz", "rapid"],
      token: "tok",
    });
    expect(result).toEqual(stats);
    const { url, init } = calls[0]!;
    expect(url.origin + url.pathname).toBe("https://explorer.lichess.org/lichess");
    expect(url.searchParams.get("fen")).toBe("8/8/8/8/8/8/8/K6k w - - 0 1");
    expect(url.searchParams.get("ratings")).toBe("1600,1800");
    expect(url.searchParams.get("speeds")).toBe("blitz,rapid");
    expect(header(init.headers, "authorization")).toBe("Bearer tok");
  });

  test("asks for the default move count and no games", async () => {
    const { client, calls } = setup(() =>
      Response.json({ white: 0, draws: 0, black: 0, moves: [] }),
    );
    await client.explorer({
      fen: "x",
      ratings: [1600],
      speeds: ["blitz"],
      token: "tok",
    });
    const { searchParams } = calls[0]!.url;
    expect(searchParams.get("moves")).toBe(String(EXPLORER_MOVES));
    expect(EXPLORER_MOVES).toBe(12);
    expect(searchParams.get("topGames")).toBe("0");
    expect(searchParams.get("recentGames")).toBe("0");
  });

  test("parses a response with moves and the opening", async () => {
    const stats = {
      white: 60,
      draws: 20,
      black: 20,
      moves: [
        {
          uci: "e2e4",
          san: "e4",
          white: 40,
          draws: 10,
          black: 10,
          averageRating: 1750,
        },
        { uci: "d2d4", san: "d4", white: 20, draws: 10, black: 10 },
      ],
      opening: { eco: "A00", name: "Start" },
    };
    const { client } = setup(() => Response.json(stats));
    const result = await client.explorer({
      fen: "x",
      ratings: [1600],
      speeds: ["blitz"],
      token: "tok",
    });
    expect(result.white).toBe(60);
    expect(result.draws).toBe(20);
    expect(result.black).toBe(20);
    expect(result.moves.map((m) => m.san)).toEqual(["e4", "d4"]);
    expect(result.opening).toEqual({ eco: "A00", name: "Start" });
  });

  test("on 429 fails fast with retryAt, without sleeping or retrying", async () => {
    const { client, calls, clock } = setup(() => new Response("", { status: 429 }));
    const error = await client
      .explorer({ fen: "x", ratings: [], speeds: [], token: "tok" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(LichessRateLimited);
    expect((error as LichessRateLimited).retryAt).toBe(NOW + 60_000);
    expect(calls).toHaveLength(1);
    expect(clock.sleeps).toEqual([]);
  });

  test("while the token is paused an explorer request throws without sending or sleeping", async () => {
    const { client, calls, clock } = setup(() => new Response("", { status: 429 }));
    const args = { fen: "x", ratings: [], speeds: [], token: "tok" };
    await client.explorer(args).catch(() => {});
    const error = await client.explorer(args).catch((e) => e);
    expect(error).toBeInstanceOf(LichessRateLimited);
    expect((error as LichessRateLimited).retryAt).toBe(NOW + 60_000);
    expect(calls).toHaveLength(1);
    expect(clock.sleeps).toEqual([]);
  });

  test("the pause from an explorer 429 still holds back the import for that token", async () => {
    const { client, calls, clock } = setup((_, i) =>
      i === 0 ? new Response("", { status: 429 }) : ndjsonResponse([game("a")]),
    );
    await client.explorer({ fen: "x", ratings: [], speeds: [], token: "tok" }).catch(() => {});
    expect((await collect(client.exportGames(exportArgs()))).map((g) => g.id)).toEqual(["a"]);
    expect(calls).toHaveLength(2);
    expect(clock.sleeps).toEqual([60_000]);
  });

  test("an explorer request recovers once the pause has elapsed", async () => {
    const stats = { white: 1, draws: 0, black: 0, moves: [] };
    const { client, clock } = setup((_, i) =>
      i === 0 ? new Response("", { status: 429 }) : Response.json(stats),
    );
    const args = { fen: "x", ratings: [], speeds: [], token: "tok" };
    await client.explorer(args).catch(() => {});
    clock.now += 60_000;
    expect(await client.explorer(args)).toEqual(stats);
  });

  test("maps 401 to LichessUnauthorized", async () => {
    const { client } = setup(() => new Response("", { status: 401 }));
    await expect(
      client.explorer({ fen: "x", ratings: [], speeds: [], token: "tok" }),
    ).rejects.toBeInstanceOf(LichessUnauthorized);
  });
});
