import { describe, expect, test } from "bun:test";
import { CARD_SEVERITIES, DEFAULT_THRESHOLDS } from "./config";
import { classifyGame, gamePhase, isTimePressure, screenCandidates, toLossCp } from "./classify";
import type { PlyEval } from "./classify";
import { parseGame } from "./pgn";
import { positionKey } from "./position";
import type { Severity } from "./config";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const PGN = `[Event "Test"]
[TimeControl "600+0"]

1. e4 { [%clk 0:10:00] } 1... e5 { [%clk 0:09:58] } 2. Nf3 { [%clk 0:00:59] } 2... Nc6 { [%clk 0:09:40] } *`;

/** Build side-to-move evals (UCI convention) from white-perspective centipawn values. */
const BEST = ["d2d4", "e7e5", "g1f3", "b8c6", "f1c4"]; // legal best move for each position of PGN
const sideToMove = (whiteCp: (number | null)[]): PlyEval[] =>
  whiteCp.map((cp, i) =>
    cp === null ? null : { cp: i % 2 === 0 ? cp : -cp, depth: 18, bestUci: BEST[i] },
  );

describe("toLossCp", () => {
  test("maps mate to plus or minus 1000", () => {
    expect(toLossCp({ mate: 3, depth: 10 })).toBe(1000);
    expect(toLossCp({ mate: -2, depth: 10 })).toBe(-1000);
    expect(toLossCp({ mate: 0, depth: 10 })).toBe(-1000);
  });

  test("clamps centipawns to plus or minus 1000", () => {
    expect(toLossCp({ cp: 4200, depth: 10 })).toBe(1000);
    expect(toLossCp({ cp: -4200, depth: 10 })).toBe(-1000);
    expect(toLossCp({ cp: 120, depth: 10 })).toBe(120);
  });
});

describe("classifyGame severity", () => {
  const classifyLoss = (loss: number) =>
    classifyGame({ pgn: PGN, evals: sideToMove([0, -loss]), userColor: "w" });

  const cases: [number, Severity | null][] = [
    [49, null],
    [50, "inaccuracy"],
    [99, "inaccuracy"],
    [100, "mistake"],
    [199, "mistake"],
    [200, "blunder"],
  ];
  test.each(cases)("loss %i cp gives %p", (loss, severity) => {
    const result = classifyLoss(loss);
    expect(result[0]?.severity ?? null).toBe(severity);
  });

  test("computes loss from the mover perspective for black", () => {
    // Black plays ply 2: position after ply 1 is black to move, +0 for black; after ply 2 white to move.
    const evals = sideToMove([0, 0, 150]); // white +150 after black's move: black lost 150
    const [m] = classifyGame({ pgn: PGN, evals, userColor: "b" });
    expect(m).toMatchObject({ ply: 2, evalBeforeCp: 0, evalAfterCp: -150, evalLossCp: 150 });
    expect(m?.severity).toBe("mistake");
  });

  test("a mate-in-one miss is a blunder with clamped loss", () => {
    const evals: PlyEval[] = [
      { mate: 1, depth: 18, bestUci: "d2d4" },
      { cp: 300, depth: 18 }, // black to move, +300 for black: white lost the mate
    ];
    const [m] = classifyGame({ pgn: PGN, evals, userColor: "w" });
    expect(m).toMatchObject({ evalBeforeCp: 1000, evalAfterCp: -300, evalLossCp: 1300 });
    expect(m?.severity).toBe("blunder");
  });

  test("only the user's own moves are classified", () => {
    const evals = sideToMove([0, -300, 0, 0, 0]); // white loses at ply 1, black at ply 2
    const white = classifyGame({ pgn: PGN, evals, userColor: "w" });
    const black = classifyGame({ pgn: PGN, evals, userColor: "b" });
    expect(white.map((m) => m.ply)).toEqual([1]);
    expect(black.map((m) => m.ply)).toEqual([2]);
  });

  test("skips plies with null or missing evals", () => {
    expect(classifyGame({ pgn: PGN, evals: sideToMove([0, null, 0]), userColor: "w" })).toEqual([]);
    expect(classifyGame({ pgn: PGN, evals: [], userColor: "w" })).toEqual([]);
    expect(
      classifyGame({ pgn: PGN, evals: sideToMove([0, -300]).slice(0, 1), userColor: "w" }),
    ).toEqual([]);
  });

  test("skips plies without a usable best move", () => {
    const evals: PlyEval[] = [
      { cp: 0, depth: 18 },
      { cp: 300, depth: 18 },
    ];
    expect(classifyGame({ pgn: PGN, evals, userColor: "w" })).toEqual([]);
  });

  test("honours custom thresholds", () => {
    const evals = sideToMove([0, -30]);
    const t = { inaccuracy: 20, mistake: 40, blunder: 60 };
    const [m] = classifyGame({ pgn: PGN, evals, userColor: "w" }, t);
    expect(m?.severity).toBe("inaccuracy");
  });

  test("returns the mistake record contents", () => {
    const [m] = classifyGame({ pgn: PGN, evals: sideToMove([0, -120]), userColor: "w" });
    expect(m).toEqual({
      ply: 1,
      positionKey: positionKey(START),
      fenBefore: START,
      playedSan: "e4",
      playedUci: "e2e4",
      bestSan: "d4",
      bestUci: "d2d4",
      evalBeforeCp: 0,
      evalAfterCp: -120,
      evalLossCp: 120,
      severity: "mistake",
      phase: "opening",
      clockLeftMs: 600000,
      clockInitialMs: 600000,
    });
  });

  test("is idempotent: the same input yields identical output", () => {
    const input = { pgn: PGN, evals: sideToMove([0, -120, 0, -250, 0]), userColor: "w" as const };
    const first = classifyGame(input);
    const second = classifyGame(input);
    expect(second).toEqual(first);
    expect(first).toHaveLength(2);
  });

  test("carded severities default to mistake and blunder", () => {
    expect([...CARD_SEVERITIES]).toEqual(["mistake", "blunder"]);
    expect(DEFAULT_THRESHOLDS).toEqual({ inaccuracy: 50, mistake: 100, blunder: 200 });
  });
});

describe("gamePhase", () => {
  test("opening below ply 20, middlegame from ply 20", () => {
    expect(gamePhase(START, 19)).toBe("opening");
    expect(gamePhase(START, 20)).toBe("middlegame");
  });

  test("endgame at non-pawn material <= 13 per side, even inside the opening ply range", () => {
    const thirteen = "rrn1k3/8/8/8/8/8/8/RRN1K3 w - - 0 30"; // 5+5+3 each
    expect(gamePhase(thirteen, 30)).toBe("endgame");
    expect(gamePhase(thirteen, 5)).toBe("endgame");
  });

  test("not an endgame at 14, or when only one side is at or below 13", () => {
    expect(gamePhase("qr2k3/8/8/8/8/8/8/QR2K3 w - - 0 30", 30)).toBe("middlegame");
    expect(gamePhase("qr2k3/8/8/8/8/8/8/RRN1K3 w - - 0 30", 30)).toBe("middlegame");
  });

  test("pawns do not count as material", () => {
    expect(gamePhase("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 40", 40)).toBe("endgame");
  });

  test("classifyGame assigns endgame from a custom start position", () => {
    const pgn = `[Event "Endgame"]
[SetUp "1"]
[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]

1. e4 Kd7 *`;
    const [m] = classifyGame({
      pgn,
      evals: [
        { cp: 0, depth: 18, bestUci: "e1d1" },
        { cp: 300, depth: 18 },
      ],
      userColor: "w",
    });
    expect(m?.phase).toBe("endgame");
  });
});

describe("isTimePressure", () => {
  test("below 10% of the base clock is time pressure", () => {
    expect(isTimePressure(59_000, 600_000)).toBe(true);
  });

  test("at or above 10% is not", () => {
    expect(isTimePressure(60_000, 600_000)).toBe(false);
    expect(isTimePressure(61_000, 600_000)).toBe(false);
  });

  test("missing clock data is never time pressure", () => {
    expect(isTimePressure(null, 600_000)).toBe(false);
    expect(isTimePressure(30_000, null)).toBe(false);
    expect(isTimePressure(30_000, 0)).toBe(false);
  });

  test("classifyGame exposes the clocks needed for the filter", () => {
    const evals = sideToMove([0, 0, 0, -300]); // white's ply 3 (Nf3) loses 300 cp
    const [m] = classifyGame({ pgn: PGN, evals, userColor: "w" });
    expect(m).toMatchObject({ ply: 3, clockLeftMs: 59_000, clockInitialMs: 600_000 });
    expect(isTimePressure(m!.clockLeftMs, m!.clockInitialMs)).toBe(true);
  });

  test("a game without clocks yields null clock data", () => {
    const pgn = `[Event "Casual"]
[TimeControl "-"]

1. e4 e5 *`;
    const [m] = classifyGame({ pgn, evals: sideToMove([0, -300]), userColor: "w" });
    expect(m).toMatchObject({ clockLeftMs: null, clockInitialMs: null });
  });
});

describe("screenCandidates", () => {
  test("returns the user's plies whose screened loss reaches the inaccuracy threshold", () => {
    const { plies } = parseGame(PGN);
    const evals = sideToMove([0, -50, 0, -49, 0]); // ply 1 loses 50, ply 3 loses 49
    expect(screenCandidates(plies, evals, "w")).toEqual([1]);
  });

  test("ignores the opponent's plies and skips null evals", () => {
    const { plies } = parseGame(PGN);
    const evals = sideToMove([0, 0, 0, null, 0]);
    expect(screenCandidates(plies, evals, "b")).toEqual([]);
    expect(screenCandidates(plies, sideToMove([0, 0, 300]), "b")).toEqual([2]);
    expect(screenCandidates(plies, evals, "w")).toEqual([]);
  });
});
