/** Piece names, glyphs and the `"wN"`-style codes the position recall drill answers with. */
import type { PieceColour, PieceLetter, PlacedPiece } from "../../lib/drills/types";

export const PIECE_LETTERS: readonly PieceLetter[] = ["K", "Q", "R", "B", "N", "P"];

export const PIECE_NAMES: Record<PieceLetter, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

/**
 * Solid glyphs for both colours (the colour comes from CSS), each followed by the text
 * presentation selector so no platform swaps the pawn for an emoji.
 */
export const PIECE_GLYPHS: Record<PieceLetter, string> = {
  K: "♚︎",
  Q: "♛︎",
  R: "♜︎",
  B: "♝︎",
  N: "♞︎",
  P: "♟︎",
};

export const EMPTY_CODE = "empty";

/** `"wN"` for a white knight, `"bP"` for a black pawn. */
export function pieceCode(colour: PieceColour, piece: PieceLetter): string {
  return `${colour === "white" ? "w" : "b"}${piece}`;
}

/** "White knight" for `"wN"`, "Empty" for `"empty"`; the code itself when it is not recognised. */
export function describePieceCode(code: string): string {
  const match = /^([wb])([KQRBNP])$/.exec(code);
  if (!match) return code === EMPTY_CODE ? "Empty" : code;
  const colour = match[1] === "w" ? "White" : "Black";
  return `${colour} ${PIECE_NAMES[match[2] as PieceLetter]}`;
}

/** "white knight on f3". */
export function describePlacedPiece(piece: PlacedPiece): string {
  return `${piece.colour} ${PIECE_NAMES[piece.piece]} on ${piece.square}`;
}
