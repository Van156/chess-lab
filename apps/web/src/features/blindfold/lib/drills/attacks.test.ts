import { describe, expect, test } from "bun:test";

import { attackedSquares, attackers, checkers, isInCheck, squaresBetween } from "./attacks";
import type { PlacedPiece } from "./types";

const w = (piece: PlacedPiece["piece"], square: string): PlacedPiece => ({
  colour: "white",
  piece,
  square,
});
const b = (piece: PlacedPiece["piece"], square: string): PlacedPiece => ({
  colour: "black",
  piece,
  square,
});
const sorted = (squares: readonly string[]) => [...squares].sort();

describe("attackedSquares", () => {
  test("a knight jumps in an L and ignores pieces in between", () => {
    const knight = w("N", "g1");
    expect(sorted(attackedSquares([knight, w("P", "g2"), w("P", "f2")], knight))).toEqual([
      "e2",
      "f3",
      "h3",
    ]);
    const centre = b("N", "d4");
    expect(attackedSquares([centre], centre)).toHaveLength(8);
  });

  test("a rook slides until the first piece, which it attacks", () => {
    const rook = w("R", "a1");
    const pieces = [rook, b("P", "a4"), w("B", "c1")];
    expect(sorted(attackedSquares(pieces, rook))).toEqual(["a2", "a3", "a4", "b1", "c1"]);
    expect(attackedSquares([rook], rook)).toHaveLength(14);
  });

  test("a bishop is blocked by any piece on its diagonal", () => {
    const bishop = w("B", "c1");
    expect(sorted(attackedSquares([bishop, w("P", "d2")], bishop))).toEqual(
      ["b2", "a3", "d2"].sort(),
    );
    expect(sorted(attackedSquares([bishop], bishop))).toEqual(
      ["b2", "a3", "d2", "e3", "f4", "g5", "h6"].sort(),
    );
  });

  test("a queen combines rook and bishop lines", () => {
    const queen = w("Q", "d4");
    expect(attackedSquares([queen], queen)).toHaveLength(27);
  });

  test("pawns attack diagonally forward for their own colour, never straight ahead", () => {
    const white = w("P", "e4");
    expect(sorted(attackedSquares([white], white))).toEqual(["d5", "f5"]);
    const black = b("P", "e5");
    expect(sorted(attackedSquares([black], black))).toEqual(["d4", "f4"]);
    const edge = w("P", "a2");
    expect(attackedSquares([edge], edge)).toEqual(["b3"]);
    const blackEdge = b("P", "h7");
    expect(attackedSquares([blackEdge], blackEdge)).toEqual(["g6"]);
  });

  test("a king attacks its neighbours", () => {
    const king = w("K", "e1");
    expect(sorted(attackedSquares([king], king))).toEqual(["d1", "d2", "e2", "f1", "f2"]);
    const corner = b("K", "h8");
    expect(sorted(attackedSquares([corner], corner))).toEqual(["g7", "g8", "h7"]);
  });
});

describe("attackers", () => {
  test("lists the pieces of one colour that attack a square", () => {
    const pieces = [
      w("K", "e1"),
      b("K", "e8"),
      b("B", "b4"),
      b("N", "f3"),
      w("R", "a1"),
      b("R", "h2"),
    ];
    expect(sorted(attackers(pieces, "e1", "black").map((piece) => piece.square))).toEqual([
      "b4",
      "f3",
    ]);
    // A piece guarding its own king's square counts too.
    expect(attackers(pieces, "e1", "white").map((piece) => piece.square)).toEqual(["a1"]);
  });

  test("a blocked line does not count", () => {
    const pieces = [w("K", "e1"), b("K", "e8"), b("B", "b4"), w("P", "d2")];
    expect(attackers(pieces, "e1", "black")).toEqual([]);
  });
});

describe("isInCheck / checkers", () => {
  test("finds the checking pieces on the king", () => {
    const pieces = [w("K", "g1"), b("K", "g8"), b("Q", "g4"), b("P", "h2")];
    expect(isInCheck(pieces, "white")).toBe(true);
    expect(sorted(checkers(pieces, "white").map((piece) => piece.square))).toEqual(["g4", "h2"]);
    expect(isInCheck(pieces, "black")).toBe(false);
  });

  test("a pawn in front of the king gives no check", () => {
    const pieces = [w("K", "e4"), b("K", "a8"), b("P", "e5")];
    expect(isInCheck(pieces, "white")).toBe(false);
  });
});

describe("squaresBetween", () => {
  test("lists the squares strictly between two aligned squares", () => {
    expect(squaresBetween("a1", "d4")).toEqual(["b2", "c3"]);
    expect(squaresBetween("h1", "h5")).toEqual(["h2", "h3", "h4"]);
    expect(squaresBetween("e5", "b5")).toEqual(["d5", "c5"]);
    expect(squaresBetween("a1", "b2")).toEqual([]);
  });

  test("is empty for squares not on a line", () => {
    expect(squaresBetween("a1", "b3")).toEqual([]);
    expect(squaresBetween("a1", "a1")).toEqual([]);
  });
});
