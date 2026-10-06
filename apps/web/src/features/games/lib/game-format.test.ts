import { describe, expect, test } from "bun:test";

import { describeAnalysis, describeFormat, gameOutcome, hasMistakesToShow } from "./game-format";

describe("describeAnalysis", () => {
  test("labels every state in words", () => {
    expect(describeAnalysis("pending").label).toBe("Waiting for analysis");
    expect(describeAnalysis("screening")).toEqual({ label: "Analysing", tone: "progress" });
    expect(describeAnalysis("confirming").label).toBe("Confirming mistakes");
    expect(describeAnalysis("complete")).toEqual({ label: "Analysed", tone: "success" });
    expect(describeAnalysis("failed")).toEqual({ label: "Analysis failed", tone: "error" });
  });
});

describe("gameOutcome", () => {
  test("reads the result from the user's colour", () => {
    expect(gameOutcome({ result: "1-0", userColor: "white" })).toBe("Win");
    expect(gameOutcome({ result: "1-0", userColor: "black" })).toBe("Loss");
    expect(gameOutcome({ result: "0-1", userColor: "black" })).toBe("Win");
    expect(gameOutcome({ result: "0-1", userColor: "white" })).toBe("Loss");
  });

  test("draws and unfinished games do not depend on colour", () => {
    expect(gameOutcome({ result: "1/2-1/2", userColor: "black" })).toBe("Draw");
    expect(gameOutcome({ result: "*", userColor: "white" })).toBe("Unfinished");
  });
});

describe("formatting", () => {
  test("describes speed and rating", () => {
    expect(describeFormat({ speed: "blitz", rated: true })).toBe("Blitz, rated");
    expect(describeFormat({ speed: "rapid", rated: false })).toBe("Rapid, casual");
  });

  test("only analysed games link to their mistakes", () => {
    expect(hasMistakesToShow("complete")).toBe(true);
    expect(hasMistakesToShow("confirming")).toBe(false);
  });
});
