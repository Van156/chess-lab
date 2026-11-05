import { describe, expect, test } from "bun:test";
import { FALLBACK_EXPLORER_BAND } from "./config";
import { ratingBandFor } from "./explorer-band";

describe("ratingBandFor", () => {
  test("uses the bucket of the perf with the most games", () => {
    expect(
      ratingBandFor({ rapid: { rating: 1650, games: 300 }, blitz: { rating: 1900, games: 40 } }),
    ).toBe(1600);
  });

  test("most games wins over a higher rating", () => {
    expect(
      ratingBandFor({ blitz: { rating: 2100, games: 10 }, classical: { rating: 1250, games: 90 } }),
    ).toBe(1200);
  });

  test("ties go to the earlier speed", () => {
    expect(
      ratingBandFor({ classical: { rating: 2300, games: 50 }, rapid: { rating: 1500, games: 50 } }),
    ).toBe(1400);
    expect(
      ratingBandFor({ rapid: { rating: 1500, games: 50 }, blitz: { rating: 1100, games: 50 } }),
    ).toBe(1000);
  });

  test("ignores provisional, unrated and zero-game perfs", () => {
    expect(
      ratingBandFor({
        blitz: { rating: 2000, games: 500, prov: true },
        rapid: { rating: Number.NaN, games: 400 },
        classical: { rating: 1810, games: 5 },
        bullet: { rating: 2400, games: 9000 },
      }),
    ).toBe(1800);
    expect(ratingBandFor({ blitz: { rating: 1500 }, rapid: { rating: 1500, games: 0 } })).toBe(
      FALLBACK_EXPLORER_BAND,
    );
  });

  test("a rating on a bucket edge stays in that bucket", () => {
    expect(ratingBandFor({ blitz: { rating: 1400, games: 1 } })).toBe(1400);
    expect(ratingBandFor({ blitz: { rating: 1399, games: 1 } })).toBe(1200);
  });

  test("ratings below 1000 use the 0 bucket and above 2500 the top bucket", () => {
    expect(ratingBandFor({ blitz: { rating: 640, games: 12 } })).toBe(0);
    expect(ratingBandFor({ blitz: { rating: 2870, games: 12 } })).toBe(2500);
  });

  test("falls back when there is no usable perf", () => {
    expect(ratingBandFor({})).toBe(1600);
    expect(ratingBandFor(null)).toBe(1600);
    expect(ratingBandFor(undefined)).toBe(1600);
    expect(ratingBandFor({ blitz: { rating: 1500, games: 80, prov: true } })).toBe(1600);
  });

  test("offset moves whole buckets", () => {
    const perfs = { rapid: { rating: 1650, games: 100 } };
    expect(ratingBandFor(perfs, 1)).toBe(1800);
    expect(ratingBandFor(perfs, -1)).toBe(1400);
    expect(ratingBandFor(perfs, 2)).toBe(2000);
    expect(ratingBandFor(perfs, -2)).toBe(1200);
  });

  test("offset stops at the ends of the bucket list", () => {
    expect(ratingBandFor({ blitz: { rating: 2600, games: 1 } }, 1)).toBe(2500);
    expect(ratingBandFor({ blitz: { rating: 2200, games: 1 } }, 2)).toBe(2500);
    expect(ratingBandFor({ blitz: { rating: 500, games: 1 } }, -1)).toBe(0);
  });

  test("offset beyond the allowed range is clamped", () => {
    const perfs = { rapid: { rating: 1650, games: 100 } };
    expect(ratingBandFor(perfs, 7)).toBe(2000);
    expect(ratingBandFor(perfs, -9)).toBe(1200);
    expect(ratingBandFor(perfs, Number.POSITIVE_INFINITY)).toBe(2000);
    expect(ratingBandFor(perfs, Number.NaN)).toBe(1600);
  });

  test("a non-integer offset is truncated", () => {
    const perfs = { rapid: { rating: 1650, games: 100 } };
    expect(ratingBandFor(perfs, 1.9)).toBe(1800);
    expect(ratingBandFor(perfs, -1.9)).toBe(1400);
    expect(ratingBandFor(perfs, 0.5)).toBe(1600);
  });

  test("offset applies to the fallback band", () => {
    expect(ratingBandFor(null, 1)).toBe(1800);
    expect(ratingBandFor(null, -2)).toBe(1200);
  });
});
