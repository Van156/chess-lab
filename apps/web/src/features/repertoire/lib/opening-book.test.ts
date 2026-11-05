import { describe, expect, test } from "bun:test";
import { START_FEN, applyMove } from "@b2c-template/chess";

import { OPENINGS } from "../data/openings.generated";
import { openingAlongPath, openingFor } from "./opening-lookup";

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

describe("the generated Lichess book", () => {
  test("names the Scotch Game line as C44", () => {
    const path = fensAfter("e4", "e5", "Nf3", "Nc6", "d4", "exd4");
    expect(openingAlongPath(OPENINGS, path)).toEqual({ eco: "C44", name: "Scotch Game" });
  });

  test("names 1. e4 and leaves the start position unnamed", () => {
    expect(openingFor(OPENINGS, last(fensAfter("e4")))?.eco).toBe("B00");
    expect(openingFor(OPENINGS, START_FEN)).toBeNull();
  });
});
