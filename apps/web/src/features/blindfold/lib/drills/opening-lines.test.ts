import { describe, expect, test } from "bun:test";
import { Chess } from "chess.js";

import { OPENING_LINES } from "./opening-lines";

describe("OPENING_LINES", () => {
  test("has about thirty lines with unique names", () => {
    expect(OPENING_LINES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(OPENING_LINES.map((line) => line.name)).size).toBe(OPENING_LINES.length);
  });

  test("every line is at least 16 plies of legal, canonical SAN", () => {
    for (const line of OPENING_LINES) {
      expect(line.moves.length, line.name).toBeGreaterThanOrEqual(16);
      const chess = new Chess();
      for (const san of line.moves) {
        let played: string;
        try {
          played = chess.move(san, { strict: true }).san;
        } catch {
          throw new Error(`${line.name}: illegal move ${san} after ${chess.history().join(" ")}`);
        }
        expect(played, line.name).toBe(san);
      }
    }
  });
});
