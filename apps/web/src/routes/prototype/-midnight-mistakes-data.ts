import type { BoardArrow } from "./-today-home-board";
import { squaresFromFen } from "./-today-home-mock-data";

/** In-memory mock data for the Midnight mistakes screen. Opponents are placeholders. */

export type Phase = "Opening" | "Middlegame" | "Endgame";

export interface Mistake {
  id: string;
  opening: string;
  phase: Phase;
  lowTime: boolean;
  /** Evaluation lost in pawns. */
  evalLoss: number;
  leftRepertoire: boolean;
  played: string;
  best: string;
  playedArrow: BoardArrow;
  bestArrow: BoardArrow;
  game: string;
  fen: string;
  lastMove: readonly string[];
}

export const PLAYED_COLOR = "#ff7a7a";

export const mistakes: readonly Mistake[] = [
  {
    id: "m-italian",
    opening: "Italian Game",
    phase: "Opening",
    lowTime: false,
    evalLoss: 1.4,
    leftRepertoire: true,
    played: "4.Ng5?",
    best: "4.c3",
    playedArrow: { from: "f3", to: "g5", color: PLAYED_COLOR },
    bestArrow: { from: "c2", to: "c3" },
    game: "vs [OPPONENT] · blitz · 3 days ago",
    fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    lastMove: ["f8", "c5"],
  },
  {
    id: "m-caro",
    opening: "Caro-Kann Defense",
    phase: "Opening",
    lowTime: false,
    evalLoss: 0.9,
    leftRepertoire: true,
    played: "5.Ng5?",
    best: "5.Ng3",
    playedArrow: { from: "e4", to: "g5", color: PLAYED_COLOR },
    bestArrow: { from: "e4", to: "g3" },
    game: "vs [OPPONENT] · blitz · 2 days ago",
    fen: "rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 2 5",
    lastMove: ["c8", "f5"],
  },
  {
    id: "m-qgd",
    opening: "Queen's Gambit Declined",
    phase: "Opening",
    lowTime: false,
    evalLoss: 0.7,
    leftRepertoire: true,
    played: "5.Qb3?!",
    best: "5.e3",
    playedArrow: { from: "d1", to: "b3", color: PLAYED_COLOR },
    bestArrow: { from: "e2", to: "e3" },
    game: "vs [OPPONENT] · rapid · 4 days ago",
    fen: "rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR w KQkq - 4 5",
    lastMove: ["f8", "e7"],
  },
  {
    id: "m-najdorf",
    opening: "Sicilian Najdorf",
    phase: "Opening",
    lowTime: false,
    evalLoss: 0.8,
    leftRepertoire: false,
    played: "6.Nb3?!",
    best: "6.Be3",
    playedArrow: { from: "d4", to: "b3", color: PLAYED_COLOR },
    bestArrow: { from: "c1", to: "e3" },
    game: "vs [OPPONENT] · rapid · 5 days ago",
    fen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
    lastMove: ["a7", "a6"],
  },
  {
    id: "m-middle",
    opening: "Italian Game",
    phase: "Middlegame",
    lowTime: true,
    evalLoss: 1.2,
    leftRepertoire: false,
    played: "15.h3?!",
    best: "15.Nb5",
    playedArrow: { from: "h2", to: "h3", color: PLAYED_COLOR },
    bestArrow: { from: "c3", to: "b5" },
    game: "vs [OPPONENT] · blitz · yesterday",
    fen: "r4rk1/pp3ppp/2nqb3/8/3P4/2N2N2/PP3PPP/R2QR1K1 w - - 0 15",
    lastMove: ["c8", "e6"],
  },
  {
    id: "m-endgame",
    opening: "Sicilian Najdorf",
    phase: "Endgame",
    lowTime: true,
    evalLoss: 1.8,
    leftRepertoire: false,
    played: "40.Rb5?",
    best: "40.Rd7",
    playedArrow: { from: "d5", to: "b5", color: PLAYED_COLOR },
    bestArrow: { from: "d5", to: "d7" },
    game: "vs [OPPONENT] · blitz · yesterday",
    fen: "8/5pk1/6p1/3R4/8/6P1/5PK1/r7 w - - 0 40",
    lastMove: ["d1", "a1"],
  },
];

export const mistakeSquares = new Map(
  mistakes.map((mistake) => [mistake.id, squaresFromFen(mistake.fen, mistake.lastMove)] as const),
);

export const openingFilters = ["All", ...new Set(mistakes.map((mistake) => mistake.opening))];
export const phaseFilters = ["All", "Opening", "Middlegame", "Endgame"] as const;
export type PhaseFilter = (typeof phaseFilters)[number];

export const importStatus = "Lichess synced 2 min ago · 9 new games analysed";
