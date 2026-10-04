import { Chess } from "chess.js";

export type PositionKey = string & { readonly __brand: "PositionKey" };

export type ParsedMove = { san: string; uci: string; fenAfter: string };

const toUci = (m: { from: string; to: string; promotion?: string | undefined }) =>
  `${m.from}${m.to}${m.promotion ?? ""}`;

const stripAnnotations = (s: string) => s.replace(/[+#!?]+$/g, "");

function load(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

/** Normalized FEN: placement, side, castling, en-passant only if a capture is legal. */
export function positionKey(fen: string): PositionKey {
  const [placement = "", side = "w", castling = "-", ep = "-"] = fen.trim().split(/\s+/);
  let epKey = "-";
  if (ep !== "-") {
    const game = load(fen);
    const capturable = game?.moves({ verbose: true }).some((m) => m.isEnPassant() && m.to === ep);
    if (capturable) epKey = ep;
  }
  return `${placement} ${side} ${castling} ${epKey}` as PositionKey;
}

export function legalMoves(fen: string): { san: string; uci: string }[] {
  const game = load(fen);
  if (!game) return [];
  return game.moves({ verbose: true }).map((m) => ({ san: m.san, uci: toUci(m) }));
}

/** Resolve SAN or UCI text (case tolerant) against the legal moves; null if none or ambiguous. */
export function parseMove(fen: string, input: string): ParsedMove | null {
  const game = load(fen);
  const text = stripAnnotations(input.trim().replace(/0/g, "O"));
  if (!game || text === "") return null;
  const moves = game.moves({ verbose: true });

  const exact = moves.find((m) => stripAnnotations(m.san) === text);
  const lowerUci = text.toLowerCase();
  const byUci = moves.filter((m) => toUci(m) === lowerUci);
  const lowerSan = text.toLowerCase();
  const bySan = moves.filter((m) => stripAnnotations(m.san).toLowerCase() === lowerSan);

  const match =
    exact ??
    (byUci.length === 1 ? byUci[0] : undefined) ??
    (bySan.length === 1 ? bySan[0] : undefined);
  if (!match) return null;
  return { san: match.san, uci: toUci(match), fenAfter: match.after };
}

export function applyMove(fen: string, input: string): string | null {
  return parseMove(fen, input)?.fenAfter ?? null;
}
