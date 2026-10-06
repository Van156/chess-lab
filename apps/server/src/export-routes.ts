import { Hono } from "hono";
import { stream } from "hono/streaming";

/**
 * Appended when the generator throws after the headers were sent (the status can no longer
 * change). JSON: the text after the truncated document makes it unparseable on purpose, so a
 * partial file can never pass for a complete one. PGN: a `;` comment line, valid PGN, readable.
 */
export const JSON_EXPORT_FAILED_MARKER = "\n/* export failed, file incomplete */";
export const PGN_EXPORT_FAILED_MARKER = "\n; export failed, file incomplete";

type SessionLike = { session: { impersonatedBy?: string | null }; user: { id: string } };

/** An impersonated session never exports the impersonated user's data (same rule as deletion). */
export function exportUserIdFromSession(current: SessionLike | null): string | null {
  return current && !current.session.impersonatedBy ? current.user.id : null;
}

export type ExportRoutesDeps = {
  /** The signed-in user's id for these headers, or null without a session. */
  getUserId: (headers: Headers) => Promise<string | null>;
  exportJson: (userId: string) => AsyncIterable<string>;
  exportPgn: (userId: string) => AsyncIterable<string>;
  /** Called with the cause when a stream fails after it started; keep the data out of the log. */
  onError?: (error: unknown) => void;
};

/** `/api/export` (ADR-20): the user's data as streamed downloads, never cached, session required. */
export function createExportRoutes({
  getUserId,
  exportJson,
  exportPgn,
  onError,
}: ExportRoutesDeps) {
  const routes = new Hono();

  function download(
    path: string,
    filename: string,
    contentType: string,
    source: typeof exportJson,
    failedMarker: string,
  ) {
    routes.get(path, async (c) => {
      c.header("Cache-Control", "no-store");
      const userId = await getUserId(c.req.raw.headers);
      if (!userId) return c.json({ message: "Unauthorized" }, 401);
      c.header("Content-Type", contentType);
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      return stream(c, async (out) => {
        try {
          // `break` closes the generator, which stops its DB paging.
          for await (const chunk of source(userId)) {
            if (out.aborted) break;
            await out.write(chunk);
          }
        } catch (error) {
          onError?.(error);
          if (!out.aborted) await out.write(failedMarker);
        }
      });
    });
  }

  download(
    "/data.json",
    "chess-lab-data.json",
    "application/json; charset=utf-8",
    exportJson,
    JSON_EXPORT_FAILED_MARKER,
  );
  download(
    "/games.pgn",
    "chess-lab-games.pgn",
    "application/x-chess-pgn; charset=utf-8",
    exportPgn,
    PGN_EXPORT_FAILED_MARKER,
  );
  return routes;
}
