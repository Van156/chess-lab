/**
 * Pure UCI protocol helpers: parse engine output lines and build GUI commands.
 * No I/O, so it is unit tested without a worker or a browser.
 */

export type UciScore = { kind: "cp"; value: number } | { kind: "mate"; value: number };

export type UciLine =
  | { type: "info"; depth: number; score: UciScore; pv: string[]; multipv: number }
  | { type: "bestmove"; move: string | null; ponder?: string }
  | { type: "spin-option"; name: string; min: number; max: number; default: number }
  | { type: "uciok" }
  | { type: "readyok" }
  | { type: "other"; line: string };

export interface EloRange {
  min: number;
  max: number;
}

/** Playing strength for a job: an Elo target, a Skill Level (0 to 20), or full strength. */
export type UciStrength = { elo: number } | { skill: number };

export type GoLimit = { depth: number } | { movetimeMs: number };

export const SKILL_LEVEL_MAX = 20;

export const UCI = "uci";
export const ISREADY = "isready";
export const STOP = "stop";

const toInt = (token: string | undefined): number | null => {
  if (token === undefined) return null;
  const value = Number.parseInt(token, 10);
  return Number.isFinite(value) ? value : null;
};

const parseInfo = (tokens: string[], line: string): UciLine => {
  let depth: number | null = null;
  let score: UciScore | null = null;
  let multipv = 1;
  let pv: string[] = [];

  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "depth") {
      depth = toInt(tokens[i + 1]);
    } else if (token === "multipv") {
      multipv = toInt(tokens[i + 1]) ?? 1;
    } else if (token === "score") {
      const kind = tokens[i + 1];
      const value = toInt(tokens[i + 2]);
      if ((kind === "cp" || kind === "mate") && value !== null) {
        score = { kind, value };
      }
    } else if (token === "pv") {
      pv = tokens.slice(i + 1);
      break;
    }
  }

  if (depth === null || score === null) return { type: "other", line };
  return { type: "info", depth, score, pv, multipv };
};

const parseOption = (tokens: string[], line: string): UciLine => {
  const typeAt = tokens.indexOf("type");
  if (tokens[1] !== "name" || typeAt < 0 || tokens[typeAt + 1] !== "spin") {
    return { type: "other", line };
  }
  const name = tokens.slice(2, typeAt).join(" ");
  const read = (key: string) => toInt(tokens[tokens.indexOf(key, typeAt) + 1]);
  const min = read("min");
  const max = read("max");
  const fallback = read("default");
  if (min === null || max === null) return { type: "other", line };
  return { type: "spin-option", name, min, max, default: fallback ?? min };
};

/** Parses one engine output line. Lines the app does not use come back as `other`. */
export const parseUciLine = (raw: string): UciLine => {
  const line = raw.trim();
  const tokens = line.split(/\s+/);

  switch (tokens[0]) {
    case "info":
      return parseInfo(tokens, line);
    case "bestmove": {
      const move = tokens[1] === "(none)" || tokens[1] === undefined ? null : tokens[1];
      const ponderAt = tokens.indexOf("ponder");
      const ponder = ponderAt > 0 ? tokens[ponderAt + 1] : undefined;
      return ponder ? { type: "bestmove", move, ponder } : { type: "bestmove", move };
    }
    case "option":
      return parseOption(tokens, line);
    case "uciok":
      return { type: "uciok" };
    case "readyok":
      return { type: "readyok" };
    default:
      return { type: "other", line };
  }
};

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Keeps the well-formed UCI moves (first occurrence only); anything else is dropped. */
export const sanitizeSearchMoves = (moves: readonly string[] | undefined): string[] => [
  ...new Set((moves ?? []).filter((move) => UCI_MOVE.test(move))),
];

/** `go` with the search limit, restricted to `searchMoves` when given (already sanitized). */
export const buildGo = (limit: GoLimit, searchMoves: readonly string[] = []): string => {
  const base = "depth" in limit ? `go depth ${limit.depth}` : `go movetime ${limit.movetimeMs}`;
  return searchMoves.length > 0 ? `${base} searchmoves ${searchMoves.join(" ")}` : base;
};

export const buildSetOption = (name: string, value?: string | number | boolean): string =>
  value === undefined ? `setoption name ${name}` : `setoption name ${name} value ${value}`;

export const buildPosition = (fen: string, moves: readonly string[] = []): string =>
  moves.length > 0 ? `position fen ${fen} moves ${moves.join(" ")}` : `position fen ${fen}`;

/**
 * Options sent before every job. No strength means analysis: strength limiting off and
 * Skill Level 20, so a weakened drill can never leak into game analysis (ADR-11).
 */
export const buildStrengthOptions = (strength: UciStrength | undefined): string[] => {
  if (strength && "elo" in strength) {
    return [buildSetOption("UCI_LimitStrength", true), buildSetOption("UCI_Elo", strength.elo)];
  }
  const skill = strength ? strength.skill : SKILL_LEVEL_MAX;
  return [buildSetOption("UCI_LimitStrength", false), buildSetOption("Skill Level", skill)];
};

/** Number of principal variations to report. Sent before every job so a count never leaks across jobs. */
export const buildMultiPvOption = (multiPv: number | undefined): string => {
  const count = multiPv !== undefined && Number.isFinite(multiPv) ? Math.floor(multiPv) : 1;
  return buildSetOption("MultiPV", Math.max(1, count));
};

/** Clamps and rounds an Elo into the range the engine reported in its handshake. */
export const clampElo = (range: EloRange, elo: number): number =>
  Math.min(range.max, Math.max(range.min, Math.round(elo)));
