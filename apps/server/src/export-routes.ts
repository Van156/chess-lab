import { Hono } from "hono";
import { stream } from "hono/streaming";

export type ExportRoutesDeps = {
  /** The signed-in user's id for these headers, or null without a session. */
  getUserId: (headers: Headers) => Promise<string | null>;
  exportJson: (userId: string) => AsyncIterable<string>;
  exportPgn: (userId: string) => AsyncIterable<string>;
};

/** `/api/export` (ADR-20): the user's data as streamed downloads, never cached, session required. */
export function createExportRoutes({ getUserId, exportJson, exportPgn }: ExportRoutesDeps) {
  const routes = new Hono();

  function download(
    path: string,
    filename: string,
    contentType: string,
    source: typeof exportJson,
  ) {
    routes.get(path, async (c) => {
      c.header("Cache-Control", "no-store");
      const userId = await getUserId(c.req.raw.headers);
      if (!userId) return c.json({ message: "Unauthorized" }, 401);
      c.header("Content-Type", contentType);
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      return stream(c, async (out) => {
        for await (const chunk of source(userId)) await out.write(chunk);
      });
    });
  }

  download("/data.json", "chess-lab-data.json", "application/json; charset=utf-8", exportJson);
  download(
    "/games.pgn",
    "chess-lab-games.pgn",
    "application/x-chess-pgn; charset=utf-8",
    exportPgn,
  );
  return routes;
}
