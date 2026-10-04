import { Chess } from "chess.js";

export type ParsedPly = {
  ply: number;
  fenBefore: string;
  san: string;
  uci: string;
  color: "w" | "b";
  clockMs: number | null;
};

export type ParsedGame = {
  headers: Record<string, string>;
  plies: ParsedPly[];
  initialClockMs: number | null;
};

const CLK = /\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/;

function parseClock(comment: string | undefined): number | null {
  const m = comment ? CLK.exec(comment) : null;
  if (!m) return null;
  return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
}

function parseInitialClock(timeControl: string | undefined): number | null {
  const m = timeControl ? /^(\d+)(?:\+\d+)?$/.exec(timeControl.trim()) : null;
  return m ? Number(m[1]) * 1000 : null;
}

/** Parse a PGN into headers, plies (with `%clk` clocks) and the initial clock. Throws on invalid PGN. */
export function parseGame(pgn: string): ParsedGame {
  const game = new Chess();
  game.loadPgn(pgn);

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(game.getHeaders())) {
    if (typeof v === "string") headers[k] = v;
  }

  const commentByFen = new Map(game.getComments().map((c) => [c.fen, c.comment]));
  const moves = game.history({ verbose: true });
  const plies = moves.map((m, i) => ({
    ply: i + 1,
    fenBefore: m.before,
    san: m.san,
    uci: `${m.from}${m.to}${m.promotion ?? ""}`,
    color: m.color,
    clockMs: parseClock(commentByFen.get(m.after)),
  }));

  return { headers, plies, initialClockMs: parseInitialClock(headers.TimeControl) };
}
