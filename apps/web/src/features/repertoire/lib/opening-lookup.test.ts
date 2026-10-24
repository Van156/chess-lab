import { describe, expect, test } from "bun:test";
import { START_FEN, applyMove } from "@b2c-template/chess";

import { openingAlongPath, openingFor, openingKey, type OpeningBook } from "./opening-lookup";

/** The FENs after each SAN move from the start position, the start included. */
function fensAfter(...sans: string[]): string[] {
  const fens = [START_FEN];
  for (const san of sans) {
    const next = applyMove(fens[fens.length - 1] as string, san);
    if (!next) throw new Error(`illegal test move ${san}`);
    fens.push(next);
  }
  return fens;
}

const last = (fens: string[]) => fens[fens.length - 1] as string;

const key = (...sans: string[]) => openingKey(last(fensAfter(...sans)));

const book: OpeningBook = {
  [key("e4")]: ["B00", "King's Pawn Game"],
  [key("e4", "e5", "Nf3", "Nc6", "d4", "exd4")]: ["C44", "Scotch Game"],
  [key("d4", "d5", "c4")]: ["D06", "Queen's Gambit"],
};

describe("openingKey", () => {
  test("ignores the move counters", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(openingKey(fen)).toBe(openingKey(fen.replace(" 0 1", " 7 40")));
  });

  test("an en passant square nobody can capture on is the same key as none", () => {
    const withSquare = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const without = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(openingKey(withSquare)).toBe(openingKey(without));
  });

  test("keeps the placement, the side to move and the castling rights", () => {
    expect(openingKey(START_FEN)).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -");
  });
});

describe("openingFor", () => {
  test("the start position has no name", () => {
    expect(openingFor(book, START_FEN)).toBeNull();
  });

  test("names a position of the book", () => {
    expect(openingFor(book, last(fensAfter("e4")))).toEqual({
      eco: "B00",
      name: "King's Pawn Game",
    });
  });

  test("the generated FEN after 1. e4 finds the name however the en passant field is written", () => {
    const fen = last(fensAfter("e4"));
    for (const ep of ["-", "e3"]) {
      const [placement, side, castling, , half, full] = fen.split(" ");
      const written = [placement, side, castling, ep, half, full].join(" ");
      expect(openingFor(book, written)?.name).toBe("King's Pawn Game");
    }
  });

  test("a transposition reaches the name by another move order", () => {
    const viaQueensPawn = fensAfter("d4", "d5", "c4");
    const viaTransposition = fensAfter("c4", "d5", "d4");
    expect(openingFor(book, last(viaTransposition))).toEqual(openingFor(book, last(viaQueensPawn)));
    expect(openingFor(book, last(viaTransposition))?.name).toBe("Queen's Gambit");
  });

  test("an unknown position has no name", () => {
    expect(openingFor(book, last(fensAfter("a3")))).toBeNull();
  });

  test("does not mistake an object property name for a position", () => {
    expect(openingFor(book, "constructor")).toBeNull();
  });
});

describe("openingAlongPath", () => {
  test("is none along the start position alone", () => {
    expect(openingAlongPath(book, fensAfter())).toBeNull();
  });

  test("is the current position's own name", () => {
    expect(openingAlongPath(book, fensAfter("e4"))?.name).toBe("King's Pawn Game");
  });

  test("falls back to the last name earlier on the path", () => {
    const path = fensAfter("e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4");
    expect(openingAlongPath(book, path)).toEqual({ eco: "C44", name: "Scotch Game" });
  });

  test("prefers the deepest known name over an earlier one", () => {
    const path = fensAfter("e4", "e5", "Nf3", "Nc6", "d4", "exd4");
    expect(openingAlongPath(book, path)?.name).toBe("Scotch Game");
  });

  test("is none when no position on the path is known", () => {
    expect(openingAlongPath(book, fensAfter("a3", "a6"))).toBeNull();
  });
});
