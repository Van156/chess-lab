import type {
  IdeaNote,
  RepertoireData,
  RepertoireMove,
  RepertoirePosition,
  RepertoireSummary,
} from "../lib/repertoire-types";

export const whiteRepertoire = {
  id: "r1",
  color: "white",
  name: "Open games",
  createdAt: new Date("2026-10-01T10:00:00Z"),
  updatedAt: new Date("2026-10-02T10:00:00Z"),
} satisfies RepertoireSummary;

export const blackRepertoire = {
  id: "r2",
  color: "black",
  name: "Sicilian Najdorf",
  createdAt: new Date("2026-10-03T10:00:00Z"),
  updatedAt: new Date("2026-10-03T10:00:00Z"),
} satisfies RepertoireSummary;

type FixtureMove = RepertoireMove;

const move = (
  id: string,
  from: string,
  to: string,
  san: string,
  uci: string,
  isUserMove: boolean,
): FixtureMove => ({ id, fromPositionId: from, toPositionId: to, san, uci, isUserMove });

/** 1. e4 e5 2. Nf3 (your move), with 1... c5 as a second reply to 1. e4. */
export const startPosition = {
  id: "p0",
  key: "start" as RepertoirePosition["key"],
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  sideToMove: "w",
} satisfies RepertoirePosition;

export const afterE4 = {
  id: "p1",
  key: "after-e4" as RepertoirePosition["key"],
  fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  sideToMove: "b",
} satisfies RepertoirePosition;

export const afterE5 = {
  id: "p2",
  key: "after-e5" as RepertoirePosition["key"],
  fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  sideToMove: "w",
} satisfies RepertoirePosition;

export const afterC5 = {
  id: "p3",
  key: "after-c5" as RepertoirePosition["key"],
  fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  sideToMove: "w",
} satisfies RepertoirePosition;

export const e4Move = move("m1", "p0", "p1", "e4", "e2e4", true);
export const e5Move = move("m2", "p1", "p2", "e5", "e7e5", false);
export const c5Move = move("m3", "p1", "p3", "c5", "c7c5", false);

export const openGameGraph = {
  repertoire: whiteRepertoire,
  startPositionId: "p0",
  positions: [startPosition, afterE4, afterE5, afterC5],
  moves: [e4Move, e5Move, c5Move],
  notes: {},
} satisfies RepertoireData;

export const emptyNote: IdeaNote = { arrows: [], highlights: [], plan: "" };

export const centreNote: IdeaNote = {
  arrows: [
    { from: "g1", to: "f3" },
    { from: "f1", to: "c4" },
  ],
  highlights: ["e4", "d4"],
  plan: "Develop the knight and aim at f7.",
};
