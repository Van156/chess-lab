import { describe, expect, test } from "bun:test";

import { fenFromPieces, formatPieceList, piecesFromFen } from "./fen";
import type { PlacedPiece } from "./types";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("piecesFromFen", () => {
  test("reads a sparse position, king first, then Q R B N P, then by square", () => {
    expect(piecesFromFen("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1")).toEqual([
      { colour: "white", piece: "K", square: "g1" },
      { colour: "white", piece: "R", square: "a1" },
      { colour: "white", piece: "P", square: "f2" },
      { colour: "white", piece: "P", square: "g2" },
      { colour: "white", piece: "P", square: "h2" },
      { colour: "black", piece: "K", square: "g8" },
      { colour: "black", piece: "P", square: "f7" },
      { colour: "black", piece: "P", square: "g7" },
      { colour: "black", piece: "P", square: "h7" },
    ]);
  });

  test("reads all 32 pieces of the start position", () => {
    const pieces = piecesFromFen(START);
    expect(pieces).toHaveLength(32);
    expect(pieces[0]).toEqual({ colour: "white", piece: "K", square: "e1" });
    expect(pieces.filter((p) => p.piece === "P")).toHaveLength(16);
  });

  test("throws on a malformed placement", () => {
    expect(() => piecesFromFen("9/8/8/8/8/8/8/8 w - - 0 1")).toThrow();
    expect(() => piecesFromFen("8/8/8 w - - 0 1")).toThrow();
  });
});

describe("fenFromPieces", () => {
  test("round-trips the placement and side to move", () => {
    const fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1";
    expect(fenFromPieces(piecesFromFen(fen), "black")).toBe(fen);
    expect(fenFromPieces(piecesFromFen(START), "white")).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
    );
  });

  test("an empty list is an empty board", () => {
    expect(fenFromPieces([], "white")).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
  });
});

describe("formatPieceList", () => {
  const pieces: PlacedPiece[] = piecesFromFen("6k1/5ppp/8/8/8/8/5PP1/R5K1 w - - 0 1");

  test("lists one side, SAN style, pawns as bare squares", () => {
    expect(formatPieceList(pieces, "white")).toBe("Kg1, Ra1, f2, g2");
    expect(formatPieceList(pieces, "black")).toBe("Kg8, f7, g7, h7");
  });

  test("sorts input that is not already ordered", () => {
    const shuffled: PlacedPiece[] = [
      { colour: "white", piece: "P", square: "b2" },
      { colour: "white", piece: "N", square: "c3" },
      { colour: "white", piece: "K", square: "e1" },
      { colour: "white", piece: "Q", square: "d1" },
      { colour: "white", piece: "P", square: "a2" },
    ];
    expect(formatPieceList(shuffled, "white")).toBe("Ke1, Qd1, Nc3, a2, b2");
  });

  test("is empty for a side with no pieces", () => {
    expect(formatPieceList([], "black")).toBe("");
  });
});
