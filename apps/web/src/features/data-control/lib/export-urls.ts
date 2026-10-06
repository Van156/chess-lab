export interface ExportUrls {
  readonly dataJson: string;
  readonly gamesPgn: string;
}

/** Absolute URLs of the personal-data export endpoints on the API server origin. */
export function buildExportUrls(serverUrl: string): ExportUrls {
  const base = serverUrl.replace(/\/+$/, "");
  return {
    dataJson: `${base}/api/export/data.json`,
    gamesPgn: `${base}/api/export/games.pgn`,
  };
}
