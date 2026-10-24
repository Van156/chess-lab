import { describe, expect, test } from "bun:test";
import { START_FEN } from "@b2c-template/chess";

import {
  buildOpeningBook,
  fenAfterPgn,
  parseOpeningRows,
  sansOf,
  verifySha256,
} from "./opening-book-build";
import { openingFor } from "./opening-lookup";

describe("sansOf", () => {
  test("drops move numbers and keeps the moves in order", () => {
    expect(sansOf("1. e4 e5 2. Nf3 Nc6")).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });
});

describe("fenAfterPgn", () => {
  test("replays the moves from the start position", () => {
    expect(fenAfterPgn("1. e4")).toContain("4P3");
    expect(fenAfterPgn("")).toBe(START_FEN);
  });

  test("throws on an illegal move", () => {
    expect(() => fenAfterPgn("1. e5")).toThrow("Illegal move");
  });
});

describe("parseOpeningRows", () => {
  test("reads the columns of each row after the header", () => {
    const tsv = "eco\tname\tpgn\nC44\tScotch Game\t1. e4 e5 2. Nf3 Nc6 3. d4\n";
    expect(parseOpeningRows(tsv)).toEqual([
      { eco: "C44", name: "Scotch Game", pgn: "1. e4 e5 2. Nf3 Nc6 3. d4" },
    ]);
  });

  test("rejects an unexpected header or a short row", () => {
    expect(() => parseOpeningRows("a\tb\tc\n")).toThrow("header");
    expect(() => parseOpeningRows("eco\tname\tpgn\nC44\tScotch Game\n")).toThrow("Bad TSV row");
  });
});

describe("verifySha256", () => {
  // SHA-256 of "abc".
  const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

  test("accepts text that matches the pinned hash", () => {
    expect(() => verifySha256("a.tsv", "abc", abc)).not.toThrow();
  });

  test("rejects changed text and names the file", () => {
    expect(() => verifySha256("b.tsv", "abd", abc)).toThrow("b.tsv");
  });
});

describe("buildOpeningBook", () => {
  const row = (eco: string, name: string, pgn: string) => ({ eco, name, pgn });

  test("keys each row by the position its line reaches", () => {
    const { book, rowCount } = buildOpeningBook([row("B00", "King's Pawn Game", "1. e4")]);
    expect(rowCount).toBe(1);
    expect(openingFor(book, fenAfterPgn("1. e4"))).toEqual({
      eco: "B00",
      name: "King's Pawn Game",
    });
  });

  test("when two lines reach one position the longer line wins", () => {
    const { book } = buildOpeningBook([
      row("A00", "Short", "1. Nf3 d5 2. Nc3 Nf6 3. Nb1 Ng8"),
      row("A01", "Long", "1. Nc3 d5 2. Nf3 Nf6 3. Nb1 Ng8 4. Nc3 Nf6 5. Nb1 Ng8"),
    ]);
    expect(Object.values(book)).toHaveLength(1);
    expect(Object.values(book)[0]).toEqual(["A01", "Long"]);
  });

  test("on equal length the earlier row stays", () => {
    const { book } = buildOpeningBook([
      row("D06", "First", "1. d4 d5 2. c4"),
      row("A10", "Second", "1. c4 d5 2. d4"),
    ]);
    expect(Object.values(book)).toEqual([["D06", "First"]]);
  });

  test("a shorter transposition after the longer line leaves the existing entry", () => {
    const { book } = buildOpeningBook([
      row("A01", "Long", "1. Nc3 d5 2. Nf3 Nf6 3. Nb1 Ng8 4. Nc3 Nf6 5. Nb1 Ng8"),
      row("A00", "Short", "1. Nf3 d5 2. Nc3 Nf6 3. Nb1 Ng8"),
    ]);
    expect(Object.values(book)).toEqual([["A01", "Long"]]);
  });
});
