/** Curated mate-in-one positions for the "Mate in one" drill, checked with chess.js in the tests. */

export type MatePosition = {
  /** The mating idea, e.g. "Back-rank mate". */
  pattern: string;
  fen: string;
  /** 1: up to 5 pieces, 2: 6 to 9 pieces, 3: 10 or more. */
  level: 1 | 2 | 3;
};

/** The level a position plays at, from the number of pieces on the board (kings included). */
export function levelForPieceCount(count: number): 1 | 2 | 3 {
  if (count <= 5) return 1;
  if (count <= 9) return 2;
  return 3;
}

/** The highest level with its own positions; higher levels reuse it. */
export const MAX_MATE_LEVEL = 3;

const position = (pattern: string, fen: string): MatePosition => ({
  pattern,
  fen,
  level: levelForPieceCount((fen.split(" ")[0] ?? "").replace(/[\d/]/g, "").length),
});

export const MATE_POSITIONS: readonly MatePosition[] = [
  position("Rook and king", "6k1/8/6K1/8/8/8/8/R7 w - - 0 1"),
  position("Rook and king", "8/8/8/8/8/5k2/r7/5K2 b - - 0 1"),
  position("Rook and king", "8/8/8/8/8/1k6/7r/K7 b - - 0 1"),
  position("Queen and king", "7k/Q7/6K1/8/8/8/8/8 w - - 0 1"),
  position("Queen and king", "8/8/8/8/8/1k6/2q5/K7 b - - 0 1"),
  position("Rook roller", "k7/7R/8/8/8/8/8/2K3R1 w - - 0 1"),
  position("Rook roller", "2k3r1/8/8/8/8/8/7r/K7 b - - 0 1"),
  position("Pawn mate", "k7/p1K5/1P6/8/8/8/8/8 w - - 0 1"),
  position("Pawn mate", "8/8/8/8/8/1p6/P1k5/K7 b - - 0 1"),
  position("Knight promotion", "8/6Pp/5K1k/7p/8/8/8/8 w - - 0 1"),
  position("Knight promotion", "8/8/8/8/7P/5k1K/6pP/8 b - - 0 1"),
  position("Promotion mate", "7k/P7/6K1/8/8/8/8/8 w - - 0 1"),
  position("Arabian mate", "7k/R7/5N2/8/8/8/8/6K1 w - - 0 1"),
  position("Arabian mate", "6k1/8/8/8/8/5n2/r7/7K b - - 0 1"),
  position("Bishop and knight", "7k/5K2/8/6N1/8/8/8/2B5 w - - 0 1"),
  position("Two bishops", "k7/5B2/1K6/4B3/8/8/8/8 w - - 0 1"),
  position("Back-rank mate", "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"),
  position("Back-rank mate", "r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1"),
  position("Smothered mate", "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1"),
  position("Smothered mate", "6k1/8/8/8/6n1/8/6PP/6RK b - - 0 1"),
  position("Anastasia's mate", "5r2/4Nppk/8/8/8/3R4/8/6K1 w - - 0 1"),
  position("Anastasia's mate", "6k1/8/3r4/8/8/8/4nPPK/5R2 b - - 0 1"),
  position("Boden's mate", "2kr4/p2n4/2p5/8/5B2/8/8/4KB2 w - - 0 1"),
  position("Boden's mate", "4kb2/8/8/5b2/8/2P5/P2N4/2KR4 b - - 0 1"),
  position("Damiano's mate", "5rk1/5p2/6P1/8/8/8/8/4K2Q w - - 0 1"),
  position("Damiano's mate", "4k2q/8/8/8/8/6p1/5P2/5RK1 b - - 0 1"),
  position("Discovered mate", "6rk/7p/8/4N3/8/8/8/B5K1 w - - 0 1"),
  position("Discovered mate", "b5k1/8/8/8/4n3/8/7P/6RK b - - 0 1"),
  position("Epaulette mate", "3rkr2/8/8/8/8/8/Q4PPP/6K1 w - - 0 1"),
  position("Epaulette mate", "6k1/q4ppp/8/8/8/8/8/3RKR2 b - - 0 1"),
  position("Lolli's mate", "6k1/5p1p/5PpQ/8/8/8/5PPP/6K1 w - - 0 1"),
  position("Lolli's mate", "6k1/5ppp/8/8/8/5pPq/5P1P/6K1 b - - 0 1"),
  position("Back-rank mate", "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"),
  position("Smothered mate", "r1b3rk/pp4pp/7N/8/8/8/PP4PP/6K1 w - - 0 1"),
  position("Smothered mate", "6k1/pp4pp/8/8/8/7n/PP4PP/R1B3RK b - - 0 1"),
  position("Queen and bishop", "r1bq1rk1/ppp2pp1/2n1p3/7Q/3P4/3B4/PPP2PPP/R3K2R w KQ - 0 1"),
  position("Queen and bishop", "r3k2r/ppp2ppp/3b4/3p4/7q/2N1P3/PPP2PP1/R1BQ1RK1 b - - 0 1"),
  position("Légal's mate", "r2q1bnr/ppp1kBpp/2np4/4N3/4P3/2N4P/PPPP1PP1/R1BbK2R w KQ - 1 8"),
  position("Fool's mate", "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"),
  position("Scholar's mate", "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"),
  position("Scholar's mate", "rnb1k1nr/pppp1ppp/8/2b1p3/4P2q/2N2N2/PPPP1PPP/R1BQKB1R b - - 0 1"),
  position("Opera mate", "1n2kb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2KR4 w k - 0 17"),
];
