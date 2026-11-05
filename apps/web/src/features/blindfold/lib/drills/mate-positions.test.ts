import { describe, expect, test } from "bun:test";
import { Chess } from "chess.js";

import { MATE_POSITIONS, levelForPieceCount } from "./mate-positions";

function matingMoves(fen: string): string[] {
  const chess = new Chess(fen);
  return chess.moves().filter((san) => san.endsWith("#"));
}

function otherSideInCheck(fen: string): boolean {
  const fields = fen.split(" ");
  fields[1] = fields[1] === "w" ? "b" : "w";
  fields[3] = "-";
  return new Chess(fields.join(" ")).inCheck();
}

describe("MATE_POSITIONS", () => {
  test("has at least 36 positions with unique FENs", () => {
    expect(MATE_POSITIONS.length).toBeGreaterThanOrEqual(36);
    expect(new Set(MATE_POSITIONS.map((p) => p.fen.split(" ").slice(0, 2).join(" "))).size).toBe(
      MATE_POSITIONS.length,
    );
  });

  test("every FEN loads, the side not to move is not in check, and a mate in one exists", () => {
    for (const { fen } of MATE_POSITIONS) {
      expect(() => new Chess(fen), fen).not.toThrow();
      expect(otherSideInCheck(fen), fen).toBe(false);
      expect(matingMoves(fen).length, fen).toBeGreaterThanOrEqual(1);
      // No pawns on the first or last rank.
      const ranks = fen.split(" ")[0]?.split("/") ?? [];
      expect(/p/i.test(`${ranks[0]}${ranks[7]}`), fen).toBe(false);
    }
  });

  test("the level follows the piece count", () => {
    for (const { fen, level } of MATE_POSITIONS) {
      const count = (fen.split(" ")[0] ?? "").replace(/[\d/]/g, "").length;
      expect(level, fen).toBe(levelForPieceCount(count));
    }
    expect([levelForPieceCount(3), levelForPieceCount(5)]).toEqual([1, 1]);
    expect([levelForPieceCount(6), levelForPieceCount(9)]).toEqual([2, 2]);
    expect(levelForPieceCount(10)).toBe(3);
  });

  test("covers every level and both colours to move", () => {
    for (const level of [1, 2, 3]) {
      const atLevel = MATE_POSITIONS.filter((p) => p.level === level);
      expect(atLevel.length, `level ${level}`).toBeGreaterThanOrEqual(8);
      expect(
        atLevel.some((p) => p.fen.includes(" w ")),
        `level ${level} white`,
      ).toBe(true);
      expect(
        atLevel.some((p) => p.fen.includes(" b ")),
        `level ${level} black`,
      ).toBe(true);
    }
  });

  test("spans many named patterns", () => {
    const patterns = new Set(MATE_POSITIONS.map((p) => p.pattern));
    expect(patterns.size).toBeGreaterThanOrEqual(12);
    for (const name of [
      "Back-rank mate",
      "Smothered mate",
      "Anastasia's mate",
      "Arabian mate",
      "Boden's mate",
      "Damiano's mate",
      "Discovered mate",
      "Pawn mate",
    ]) {
      expect(patterns.has(name), name).toBe(true);
    }
  });
});
