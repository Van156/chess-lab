/** In-memory mock data for the "Today" home screen prototype. No API, no auth. */

export const today = {
  greeting: "Good evening, Alex",
  date: "Sunday, October 4",
  sync: "Lichess synced 2 min ago",
  account: "Alex",
  streakDays: 12,
} as const;

export const navItems = ["Today", "Repertoire", "Mistakes", "Blindfold", "Progress"] as const;

export const queue = {
  total: 18,
  minutes: 15,
  parts: [
    { label: "Mistakes", count: 7 },
    { label: "Opening lines", count: 8 },
    { label: "Blindfold drills", count: 3 },
  ],
} as const;

export const nextUp = {
  prompt: "You played 4.Nxe5? Find a better move.",
  context: "Italian Game · vs [OPPONENT] · blitz, 3 days ago",
  moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4",
  fen: "r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  lastMove: ["c6", "d4"],
} as const;

export const pillars = [
  {
    key: "mistakes",
    title: "Mistakes",
    value: "23",
    unit: "new",
    detail: "from 9 games this week",
  },
  {
    key: "repertoire",
    title: "Repertoire",
    value: "80",
    unit: "lines",
    detail: "42 White · 38 Black",
  },
  {
    key: "blindfold",
    title: "Blindfold",
    value: "24",
    unit: "moves",
    detail: "best replay, no peeks",
  },
] as const;

export type PieceColor = "w" | "b";

export interface BoardSquare {
  /** Algebraic name, e.g. "e4". */
  name: string;
  light: boolean;
  /** Piece glyph in the solid set, always paired with U+FE0E for text presentation. */
  glyph: string | null;
  color: PieceColor | null;
  lastMove: boolean;
}

const GLYPHS: Record<string, string> = {
  k: "♚︎",
  q: "♛︎",
  r: "♜︎",
  b: "♝︎",
  n: "♞︎",
  p: "♟︎",
};

/** Parses the piece-placement field of a FEN into 64 squares, rank 8 to rank 1, file a to h. */
function squaresFromFen(fen: string, lastMove: readonly string[]): BoardSquare[] {
  const rows = fen.split(" ")[0].split("/");
  return rows.flatMap((row, rowIndex) => {
    const cells: (string | null)[] = [];
    for (const char of row) {
      if (/\d/.test(char)) cells.push(...Array<null>(Number(char)).fill(null));
      else cells.push(char);
    }
    return cells.map((char, fileIndex) => {
      const name = `${"abcdefgh"[fileIndex]}${8 - rowIndex}`;
      return {
        name,
        light: (fileIndex + rowIndex) % 2 === 0,
        glyph: char ? GLYPHS[char.toLowerCase()] : null,
        color: char ? (char === char.toLowerCase() ? "b" : "w") : null,
        lastMove: lastMove.includes(name),
      } satisfies BoardSquare;
    });
  });
}

export const boardSquares: readonly BoardSquare[] = squaresFromFen(nextUp.fen, nextUp.lastMove);

export const boardLabel = `Chess position after ${nextUp.moves}. White to move.`;
