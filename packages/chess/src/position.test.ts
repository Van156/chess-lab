import { describe, expect, test } from "bun:test";
import { applyMove, legalMoves, parseMove, positionKey } from "./position";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("positionKey", () => {
  test("ignores move clocks", () => {
    const a = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const b = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 12 40";
    expect(positionKey(a)).toBe(positionKey(b));
  });

  test("same key for transposed move orders", () => {
    const play = (moves: string[]) => {
      let fen = START;
      for (const m of moves) fen = parseMove(fen, m)!.fenAfter;
      return fen;
    };
    const a = play(["Nf3", "Nf6", "Nc3", "Nc6"]);
    const b = play(["Nc3", "Nc6", "Nf3", "Nf6"]);
    expect(positionKey(a)).toBe(positionKey(b));
  });

  test("includes castling rights", () => {
    const withRights = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const without = "r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1";
    expect(positionKey(withRights)).not.toBe(positionKey(without));
  });

  test("drops en-passant square when no capture is legal", () => {
    const raw = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    expect(positionKey(raw).split(" ")[3]).toBe("-");
  });

  test("keeps en-passant square when capture is legal", () => {
    const fen = "rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3";
    expect(positionKey(fen).split(" ")[3]).toBe("e3");
  });
});

describe("parseMove", () => {
  test("parses SAN", () => {
    expect(parseMove(START, "Nf3")).toMatchObject({ san: "Nf3", uci: "g1f3" });
  });

  test("parses UCI", () => {
    expect(parseMove(START, "g1f3")).toMatchObject({ san: "Nf3", uci: "g1f3" });
  });

  test("is case tolerant", () => {
    expect(parseMove(START, "nf3")?.san).toBe("Nf3");
    expect(parseMove(START, "E4")?.san).toBe("e4");
    expect(parseMove(START, "G1F3")?.san).toBe("Nf3");
  });

  test("returns null for illegal, ambiguous or malformed input", () => {
    expect(parseMove(START, "Ke4")).toBeNull();
    expect(parseMove(START, "hello")).toBeNull();
    expect(parseMove(START, "")).toBeNull();
    expect(parseMove("4k3/8/8/8/8/8/8/R3K2R w - - 0 1", "Rd1")?.san).toBe("Rd1");
    expect(parseMove("4k3/8/8/8/8/8/3R1R2/4K3 w - - 0 1", "Rd2e2")).toBeNull();
    expect(parseMove("4k3/8/8/8/8/8/R6R/4K3 w - - 0 1", "Rd2")).toBeNull();
  });

  test("resolves O-O, 0-0 and the UCI king move to the same castling move", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const letters = parseMove(fen, "O-O");
    expect(letters).toMatchObject({ san: "O-O", uci: "e1g1" });
    expect(parseMove(fen, "0-0")).toEqual(letters!);
    expect(parseMove(fen, "e1g1")).toEqual(letters!);
    const long = parseMove(fen, "O-O-O");
    expect(parseMove(fen, "0-0-0")).toEqual(long!);
    expect(parseMove(fen, "e1c1")).toEqual(long!);
  });

  test("handles promotion", () => {
    const fen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";
    expect(parseMove(fen, "a8=Q+")).toMatchObject({ san: "a8=Q+", uci: "a7a8q" });
    expect(parseMove(fen, "a7a8n")).toMatchObject({ uci: "a7a8n" });
  });

  test("returns fenAfter", () => {
    expect(parseMove(START, "e4")?.fenAfter).toContain("4P3");
  });
});

describe("legalMoves", () => {
  test("lists 20 moves from the start", () => {
    expect(legalMoves(START)).toHaveLength(20);
  });

  test("returns SAN and UCI", () => {
    expect(legalMoves(START)).toContainEqual({ san: "Nf3", uci: "g1f3" });
  });
});

describe("applyMove", () => {
  test("returns the new FEN", () => {
    expect(applyMove(START, "e4")).toBe(parseMove(START, "e4")!.fenAfter);
  });

  test("returns null for an illegal move", () => {
    expect(applyMove(START, "e5")).toBeNull();
  });
});
