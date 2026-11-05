/** Conversions between FEN strings and the `PlacedPiece` lists the drills show and read aloud. */
import { formatSquare } from "../squares";
import type { PieceColour, PieceLetter, PlacedPiece } from "./types";

const PIECE_ORDER: readonly PieceLetter[] = ["K", "Q", "R", "B", "N", "P"];
const PIECE_LETTERS = new Set<string>(PIECE_ORDER);

function comparePieces(a: PlacedPiece, b: PlacedPiece): number {
  if (a.colour !== b.colour) return a.colour === "white" ? -1 : 1;
  const byPiece = PIECE_ORDER.indexOf(a.piece) - PIECE_ORDER.indexOf(b.piece);
  if (byPiece !== 0) return byPiece;
  return a.square < b.square ? -1 : a.square > b.square ? 1 : 0;
}

/** Sorts pieces: White before Black, then king, queen, rook, bishop, knight, pawn, then by square. */
export function sortPieces(pieces: readonly PlacedPiece[]): PlacedPiece[] {
  return [...pieces].sort(comparePieces);
}

/**
 * Reads the placement field of a FEN into a sorted piece list (see `sortPieces`). Throws when the
 * placement is not eight ranks of eight squares.
 */
export function piecesFromFen(fen: string): PlacedPiece[] {
  const ranks = (fen.trim().split(/\s+/)[0] ?? "").split("/");
  if (ranks.length !== 8) throw new Error(`Invalid FEN placement: ${fen}`);
  const pieces: PlacedPiece[] = [];
  ranks.forEach((row, index) => {
    const rank = 7 - index;
    let file = 0;
    for (const char of row) {
      if (/[1-8]/.test(char)) {
        file += Number(char);
        continue;
      }
      const letter = char.toUpperCase();
      if (!PIECE_LETTERS.has(letter) || file > 7) throw new Error(`Invalid FEN placement: ${fen}`);
      pieces.push({
        colour: char === letter ? "white" : "black",
        piece: letter as PieceLetter,
        square: formatSquare(file, rank),
      });
      file += 1;
    }
    if (file !== 8) throw new Error(`Invalid FEN placement: ${fen}`);
  });
  return sortPieces(pieces);
}

/** Builds a FEN from a piece list, with no castling or en passant rights. */
export function fenFromPieces(pieces: readonly PlacedPiece[], toMove: PieceColour): string {
  const board: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const { colour, piece, square } of pieces) {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const row = board[7 - rank];
    if (!row || file < 0 || file > 7) throw new Error(`Invalid square: ${square}`);
    row[file] = colour === "white" ? piece : piece.toLowerCase();
  }
  const placement = board
    .map((row) => {
      let text = "";
      let empty = 0;
      for (const cell of row) {
        if (cell === null) {
          empty += 1;
          continue;
        }
        if (empty > 0) text += String(empty);
        empty = 0;
        text += cell;
      }
      return empty > 0 ? text + String(empty) : text;
    })
    .join("/");
  return `${placement} ${toMove === "white" ? "w" : "b"} - - 0 1`;
}

/** One side's pieces in SAN style, sorted: `"Kg1, Ra1, f2, g2"` (pawns as bare squares). */
export function formatPieceList(pieces: readonly PlacedPiece[], colour: PieceColour): string {
  return sortPieces(pieces.filter((piece) => piece.colour === colour))
    .map(({ piece, square }) => (piece === "P" ? square : `${piece}${square}`))
    .join(", ");
}
