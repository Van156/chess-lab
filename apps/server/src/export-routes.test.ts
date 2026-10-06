import { describe, expect, test } from "bun:test";

import { createExportRoutes } from "./export-routes";

async function* chunks(...parts: string[]) {
  for (const part of parts) yield part;
}

function routes(userId: string | null) {
  const calls: string[] = [];
  const app = createExportRoutes({
    getUserId: async () => userId,
    exportJson: (id) => {
      calls.push(`json:${id}`);
      return chunks('{"a":', "1}");
    },
    exportPgn: (id) => {
      calls.push(`pgn:${id}`);
      return chunks("[Event]\n\n1. e4 *", "\n");
    },
  });
  return { app, calls };
}

describe("export routes", () => {
  for (const path of ["/data.json", "/games.pgn"]) {
    test(`${path} rejects a request without a session`, async () => {
      const { app, calls } = routes(null);
      const response = await app.request(path);
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(calls).toEqual([]);
    });
  }

  test("/data.json streams the caller's JSON as an attachment", async () => {
    const { app, calls } = routes("u1");
    const response = await app.request("/data.json");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toStartWith("attachment");
    expect(response.headers.get("Content-Disposition")).toContain("chess-lab-data.json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toStartWith("application/json");
    expect(JSON.parse(await response.text())).toEqual({ a: 1 });
    expect(calls).toEqual(["json:u1"]);
  });

  test("/games.pgn streams the caller's PGN as an attachment", async () => {
    const { app, calls } = routes("u1");
    const response = await app.request("/games.pgn");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toStartWith("attachment");
    expect(response.headers.get("Content-Disposition")).toContain("chess-lab-games.pgn");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toStartWith("application/x-chess-pgn");
    expect(await response.text()).toBe("[Event]\n\n1. e4 *\n");
    expect(calls).toEqual(["pgn:u1"]);
  });
});
