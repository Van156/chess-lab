import { squaresFromFen } from "./-today-home-mock-data";
import type { BoardArrow } from "./-today-home-board";

/** In-memory mock data for the Midnight repertoire screen. */

export type Side = "White" | "Black";
export type LineStatus = "Due" | "Learning" | "Solid";

export interface RepertoireLine {
  id: string;
  side: Side;
  name: string;
  eco: string;
  moves: string;
  fen: string;
  lastMove: readonly string[];
  /** Visual idea note: arrows and squares to look at, plus a one-line plan. */
  arrows: readonly BoardArrow[];
  highlights: readonly string[];
  plan: string;
  status: LineStatus;
  /** Lichess explorer at the user's rating band: games and result split from White's view. */
  explorer: { games: string; white: number; draw: number; black: number };
}

export const repertoireLines: readonly RepertoireLine[] = [
  {
    id: "w-italian",
    side: "White",
    name: "Italian Game, Giuoco Pianissimo",
    eco: "C54",
    moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3",
    fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    lastMove: ["f8", "c5"],
    arrows: [
      { from: "c2", to: "c3" },
      { from: "d2", to: "d4" },
    ],
    highlights: ["d4", "e5"],
    plan: "Build c3 and d4 to take the centre, then reroute the knight with Nbd2-b3.",
    status: "Due",
    explorer: { games: "412k", white: 38, draw: 13, black: 49 },
  },
  {
    id: "w-ruy",
    side: "White",
    name: "Ruy Lopez, Morphy Defense",
    eco: "C78",
    moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4",
    fen: "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
    lastMove: ["a7", "a6"],
    arrows: [{ from: "b5", to: "a4" }],
    highlights: ["c6", "e5"],
    plan: "Keep the pin pressure on c6; the e5 pawn only falls if Black's knight leaves.",
    status: "Solid",
    explorer: { games: "287k", white: 41, draw: 9, black: 50 },
  },
  {
    id: "w-qgd",
    side: "White",
    name: "Queen's Gambit Declined, 4.Bg5",
    eco: "D37",
    moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3",
    fen: "rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR w KQkq - 4 5",
    lastMove: ["f8", "e7"],
    arrows: [{ from: "e2", to: "e3" }],
    highlights: ["c4", "d4"],
    plan: "Solid centre first; pressure d5 with cxd5 and a minority attack on the queenside.",
    status: "Learning",
    explorer: { games: "198k", white: 44, draw: 11, black: 45 },
  },
  {
    id: "b-caro",
    side: "Black",
    name: "Caro-Kann, Classical",
    eco: "B19",
    moves: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5",
    fen: "rnbqkbnr/pp2pppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR b KQkq - 0 4",
    lastMove: ["c3", "e4"],
    arrows: [{ from: "c8", to: "f5" }],
    highlights: ["e4", "f5"],
    plan: "Develop the light bishop outside the pawn chain before playing e6.",
    status: "Solid",
    explorer: { games: "356k", white: 47, draw: 10, black: 43 },
  },
  {
    id: "b-najdorf",
    side: "Black",
    name: "Sicilian Najdorf, Open Sicilian",
    eco: "B90",
    moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6",
    fen: "rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4",
    lastMove: ["f3", "d4"],
    arrows: [{ from: "g8", to: "f6" }],
    highlights: ["e4", "d4"],
    plan: "Hit e4 immediately, then play a6 to stop Bb5 and Nb5 ideas.",
    status: "Due",
    explorer: { games: "521k", white: 49, draw: 8, black: 43 },
  },
  {
    id: "b-qgd",
    side: "Black",
    name: "Queen's Gambit Declined",
    eco: "D30",
    moves: "1.d4 d5 2.c4 e6",
    fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2",
    lastMove: ["c2", "c4"],
    arrows: [{ from: "e7", to: "e6" }],
    highlights: ["d5", "c4"],
    plan: "Support d5 with e6 and keep the position closed; free the game with ...c5 later.",
    status: "Learning",
    explorer: { games: "264k", white: 45, draw: 12, black: 43 },
  },
];

export const repertoireSquares = new Map(
  repertoireLines.map((line) => [line.id, squaresFromFen(line.fen, line.lastMove)] as const),
);

export const sides: readonly Side[] = ["White", "Black"];
