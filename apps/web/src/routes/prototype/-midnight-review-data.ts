import { squaresFromFen } from "./-today-home-mock-data";

/** In-memory mock data for the Midnight review session screen. */

export type CardKind = "Mistake" | "Opening line" | "Blindfold";

export interface ReviewCard {
  id: string;
  kind: CardKind;
  prompt: string;
  context: string;
  fen: string;
  lastMove: readonly string[];
  /** Best move in SAN, revealed by "Show answer". */
  answer: string;
  explanation: string;
}

export const reviewCards: readonly ReviewCard[] = [
  {
    id: "italian-c3",
    kind: "Opening line",
    prompt: "Italian Game, Giuoco Piano. White to play move 4.",
    context: "Repertoire (White) · due today · interval 6 days",
    fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    lastMove: ["f8", "c5"],
    answer: "4.c3",
    explanation: "Prepares d4 and keeps the bishop pair. This is your main line against 3...Bc5.",
  },
  {
    id: "caro-bg3",
    kind: "Mistake",
    prompt: "You played 5.Ng5? against [OPPONENT]. Find a better move.",
    context: "Caro-Kann · blitz, 2 days ago · lost 0.9",
    fen: "rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 2 5",
    lastMove: ["c8", "f5"],
    answer: "5.Ng3",
    explanation: "Challenges the bishop and keeps the knight safe on g3.",
  },
  {
    id: "qgd-e3",
    kind: "Opening line",
    prompt: "Queen's Gambit Declined. White to play move 5.",
    context: "Repertoire (White) · new line · learning step 2",
    fen: "rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR w KQkq - 4 5",
    lastMove: ["f8", "e7"],
    answer: "5.e3",
    explanation: "Solid development; the bishop on g5 is already pinning the knight.",
  },
  {
    id: "najdorf-be3",
    kind: "Mistake",
    prompt: "You played 6.Nb3?! Find a better move.",
    context: "Sicilian Najdorf · rapid, 5 days ago · lost 0.8",
    fen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
    lastMove: ["a7", "a6"],
    answer: "6.Be3",
    explanation: "The English Attack setup: Be3, f3, Qd2 and long castling.",
  },
  {
    id: "rook-ending",
    kind: "Mistake",
    prompt: "You played 40.Rb5? in a rook ending. Find a better move.",
    context: "Rook endgame · blitz, 1 day ago · lost 1.8 · low time",
    fen: "8/5pk1/6p1/3R4/8/6P1/5PK1/r7 w - - 0 40",
    lastMove: ["d1", "a1"],
    answer: "40.Rd7",
    explanation: "Active rook behind the pawns; it attacks f7 and cuts off the king.",
  },
];

export const reviewSquares = new Map(
  reviewCards.map((card) => [card.id, squaresFromFen(card.fen, card.lastMove)] as const),
);

export const reviewSession = {
  /** Cards already graded when the session screen opens. */
  startOffset: 2,
  total: 18,
} as const;

export const grades = [
  { label: "Again", hint: "<1 min", tone: "border-red-400 text-red-300" },
  { label: "Hard", hint: "2 d", tone: "border-amber-300 text-amber-200" },
  { label: "Good", hint: "6 d", tone: "border-(--accent) text-(--accent)" },
  { label: "Easy", hint: "14 d", tone: "border-sky-300 text-sky-200" },
] as const;
