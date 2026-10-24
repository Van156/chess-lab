import type {
  ExplorerData,
  ExplorerUnavailableReason,
  IdeaNote,
  RepertoireData,
  RepertoireMove,
  RepertoirePosition,
  RepertoireSummary,
} from "../lib/repertoire-types";
import type { EngineView } from "../lib/suggestion-state";

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

const speeds: ExplorerData["speeds"] = ["blitz", "rapid", "classical"];
const explorerBase = { band: 1600, ownBand: 1600, offset: 0, speeds };

/** Explorer answer for the position after 1. e4: e5 is in the repertoire, c5 and e6 are not. */
export const explorerOk = {
  ...explorerBase,
  result: {
    status: "ok",
    stale: false,
    totals: { white: 5200, draws: 3000, black: 1800, games: 10000 },
    opening: { eco: "B00", name: "King's Pawn Game" },
    moves: [
      { san: "c5", uci: "c7c5", white: 2100, draws: 1200, black: 700, games: 4000 },
      { san: "e5", uci: "e7e5", white: 1900, draws: 1100, black: 700, games: 3700 },
      { san: "e6", uci: "e7e6", white: 1200, draws: 700, black: 400, games: 2300 },
    ],
  },
} satisfies ExplorerData;

export const explorerStale = {
  ...explorerOk,
  result: { ...explorerOk.result, stale: true },
} satisfies ExplorerData;

export const explorerEmpty = {
  ...explorerBase,
  result: {
    status: "ok",
    stale: false,
    totals: { white: 0, draws: 0, black: 0, games: 0 },
    opening: null,
    moves: [],
  },
} satisfies ExplorerData;

export const explorerUnavailable = (reason: ExplorerUnavailableReason) =>
  ({ ...explorerBase, result: { status: "unavailable", reason } }) satisfies ExplorerData;

/** The same answer one band above the user's own, as after choosing "1 above". */
export const explorerOneBandAbove = {
  ...explorerOk,
  band: 1800,
  offset: 1,
} satisfies ExplorerData;

const suggestion = (
  multipv: number,
  scoreText: string,
  scoreLabel: string,
  san: string,
  uci: string,
  moveText: string,
  inRepertoire = false,
) => ({
  multipv,
  depth: 14,
  white: { kind: "cp" as const, cp: 0 },
  scoreText,
  scoreLabel,
  firstMove: { san, uci },
  moveText,
  inRepertoire,
});

/** Three lines from the start position; the second first move is already in the repertoire. */
export const engineLines = [
  suggestion(
    1,
    "+0.34",
    "White is better by 0.34 pawns",
    "e4",
    "e2e4",
    "1. e4 e5 2. Nf3 Nc6",
    true,
  ),
  suggestion(2, "+0.28", "White is better by 0.28 pawns", "d4", "d2d4", "1. d4 d5 2. c4 e6"),
  suggestion(3, "+0.20", "White is better by 0.20 pawns", "Nf3", "g1f3", "1. Nf3 d5 2. g3 Nf6"),
];

/** The builder's engine view with a finished search: three lines, a bar share and line 1's arrow. */
export const engineOnView: EngineView = {
  panel: { kind: "done", depth: 18, maxDepth: 18, lines: engineLines },
  whitePercent: 53,
  arrow: { from: "e2", to: "e4" },
};

/** The builder's engine view with the switch off: no bar share and no arrow. */
export const engineOffView: EngineView = {
  panel: { kind: "off" },
  whitePercent: null,
  arrow: null,
};
