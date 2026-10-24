import { describe, expect, test } from "bun:test";

import {
  STALE_NOTE,
  bandLabel,
  describeExplorerMove,
  inRepertoire,
  shareOf,
  unavailableText,
} from "./explorer-view";

describe("shareOf", () => {
  test("rounds to integer percentages that add up to 100", () => {
    const share = shareOf({ white: 1, draws: 1, black: 1, games: 3 });
    expect(share.white + share.draws + share.black).toBe(100);
    expect(share).toEqual({ white: 34, draws: 33, black: 33 });
  });

  test("gives the leftover point to the largest remainder", () => {
    expect(shareOf({ white: 52, draws: 31, black: 17, games: 100 })).toEqual({
      white: 52,
      draws: 31,
      black: 17,
    });
    expect(shareOf({ white: 5, draws: 3, black: 1, games: 9 })).toEqual({
      white: 56,
      draws: 33,
      black: 11,
    });
  });

  test("is all zero when there are no games", () => {
    expect(shareOf({ white: 0, draws: 0, black: 0, games: 0 })).toEqual({
      white: 0,
      draws: 0,
      black: 0,
    });
  });
});

describe("describeExplorerMove", () => {
  test("states the games and the three shares in words", () => {
    expect(
      describeExplorerMove({ san: "e4", white: 624, draws: 370, black: 240, games: 1234 }),
    ).toBe("e4: 1,234 games. White 51%, draws 30%, Black 19%.");
  });

  test("uses the singular for one game", () => {
    expect(describeExplorerMove({ san: "h4", white: 1, draws: 0, black: 0, games: 1 })).toBe(
      "h4: 1 game. White 100%, draws 0%, Black 0%.",
    );
  });
});

describe("bandLabel", () => {
  test("spans from the bucket to just below the next one", () => {
    expect(bandLabel(1600)).toBe("1600–1799");
    expect(bandLabel(1000)).toBe("1000–1199");
    expect(bandLabel(2200)).toBe("2200–2499");
  });

  test("names the open ends", () => {
    expect(bandLabel(0)).toBe("Under 1000");
    expect(bandLabel(2500)).toBe("2500+");
  });
});

describe("inRepertoire", () => {
  test("matches by SAN against the moves already in the position", () => {
    const children = [{ san: "e5" }, { san: "c5" }];
    expect(inRepertoire("c5", children)).toBe(true);
    expect(inRepertoire("e6", children)).toBe(false);
    expect(inRepertoire("e5", [])).toBe(false);
  });
});

describe("unavailableText", () => {
  test("tells an unlinked account to sign in with Lichess again", () => {
    expect(unavailableText("unauthorized")).toContain("sign in with Lichess again");
  });

  test("gives each other reason its own wording", () => {
    const texts = (["rate_limited", "timeout", "error"] as const).map(unavailableText);
    expect(new Set(texts).size).toBe(3);
    expect(unavailableText("rate_limited")).toContain("busy");
    expect(unavailableText("timeout")).toContain("did not answer");
    expect(unavailableText("error")).toContain("unavailable right now");
  });
});

test("the stale note says the stats are saved results", () => {
  expect(STALE_NOTE).toContain("saved");
});
