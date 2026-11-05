import { describe, expect, test } from "bun:test";

import {
  createExportRoutes,
  exportUserIdFromSession,
  JSON_EXPORT_FAILED_MARKER,
  PGN_EXPORT_FAILED_MARKER,
} from "./export-routes";

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

  describe("failures while streaming", () => {
    async function* failingAfter(first: string): AsyncGenerator<string> {
      yield first;
      throw new Error("db went away");
    }

    function failingRoutes(onError: (error: unknown) => void) {
      return createExportRoutes({
        getUserId: async () => "u1",
        exportJson: () => failingAfter('{"games":['),
        exportPgn: () => failingAfter("[Event]\n\n1. e4 *"),
        onError,
      });
    }

    test("JSON: reports the error and ends with a marker that makes the document invalid", async () => {
      const errors: unknown[] = [];
      const response = await failingRoutes((error) => errors.push(error)).request("/data.json");
      const body = await response.text();
      expect(errors).toHaveLength(1);
      expect(body).toStartWith('{"games":[');
      expect(body).toEndWith(JSON_EXPORT_FAILED_MARKER);
      expect(() => JSON.parse(body)).toThrow();
    });

    test("PGN: reports the error and appends a trailing comment line", async () => {
      const errors: unknown[] = [];
      const response = await failingRoutes((error) => errors.push(error)).request("/games.pgn");
      const body = await response.text();
      expect(errors).toHaveLength(1);
      expect(body).toStartWith("[Event]");
      expect(body).toEndWith(PGN_EXPORT_FAILED_MARKER);
      expect(PGN_EXPORT_FAILED_MARKER).toContain("\n; ");
    });

    test("a client abort stops pulling pages and closes the generator", async () => {
      let pulls = 0;
      let closed = false;
      async function* pages(): AsyncGenerator<string> {
        try {
          for (;;) {
            pulls += 1;
            yield "x".repeat(1024);
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        } finally {
          closed = true;
        }
      }
      const app = createExportRoutes({
        getUserId: async () => "u1",
        exportJson: () => pages(),
        exportPgn: () => pages(),
      });
      const controller = new AbortController();
      const response = await app.request(
        new Request("http://localhost/data.json", { signal: controller.signal }),
      );
      const reader = response.body!.getReader();
      await reader.read();
      await reader.cancel();
      await new Promise((resolve) => setTimeout(resolve, 60));
      const settled = pulls;
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(pulls).toBe(settled);
      expect(settled).toBeLessThan(6);
      expect(closed).toBe(true);
    });
  });
});

describe("exportUserIdFromSession", () => {
  test("no session gives null", () => {
    expect(exportUserIdFromSession(null)).toBeNull();
  });

  test("an impersonated session gives null", () => {
    expect(
      exportUserIdFromSession({ session: { impersonatedBy: "admin1" }, user: { id: "u1" } }),
    ).toBeNull();
  });

  test("a normal session gives the user id", () => {
    expect(exportUserIdFromSession({ session: { impersonatedBy: null }, user: { id: "u1" } })).toBe(
      "u1",
    );
    expect(exportUserIdFromSession({ session: {}, user: { id: "u2" } })).toBe("u2");
  });
});
