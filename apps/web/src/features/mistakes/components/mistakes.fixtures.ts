import type { MistakeDetail, MistakeItem } from "../lib/mistakes-types";

/** Shared by the stories and the SSR tests. */
export const mistakeItem: MistakeItem = {
  id: "m1",
  gameId: "g1",
  ply: 3,
  fenBefore: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  playedSan: "a3",
  playedUci: "a2a3",
  bestSan: "Nf3",
  bestUci: "g1f3",
  evalBeforeCp: 40,
  evalAfterCp: -120,
  evalLossCp: 160,
  severity: "mistake",
  phase: "opening",
  clockLeftMs: 95_000,
  clockInitialMs: 300_000,
  eco: "C20",
  openingName: "King's Pawn Game",
  playedAt: new Date("2026-10-04T18:20:00Z"),
};

export const mistakeDetail: MistakeDetail = {
  ...mistakeItem,
  positionKey: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -",
  createdAt: new Date("2026-10-05T08:10:00Z"),
  game: {
    id: "g1",
    lichessGameId: "abcd1234",
    pgn: '[Event "Rated Blitz game"]\n[Result "0-1"]\n\n1. e4 e5 2. a3 0-1',
    userColor: "white",
    result: "0-1",
    playedAt: new Date("2026-10-04T18:20:00Z"),
  },
};
