import { describe, expect, test } from "bun:test";

import {
  dayKey,
  formatPracticeTime,
  overallAccuracy,
  practiceStrip,
  STRIP_DAYS,
} from "./practice-summary";

describe("practiceStrip", () => {
  test("covers the last 28 days, oldest first, ending today", () => {
    const strip = practiceStrip(
      [
        { day: "2026-11-05", sessions: 2 },
        { day: "2026-10-09", sessions: 1 },
        { day: "2026-10-08", sessions: 4 },
      ],
      "2026-11-05",
    );
    expect(strip).toHaveLength(STRIP_DAYS);
    expect(strip[0]).toEqual({ day: "2026-10-09", sessions: 1 });
    expect(strip.at(-1)).toEqual({ day: "2026-11-05", sessions: 2 });
    expect(strip.reduce((sum, entry) => sum + entry.sessions, 0)).toBe(3);
  });

  test("crosses month and year ends", () => {
    const strip = practiceStrip([], "2027-01-02", 3);
    expect(strip.map((entry) => entry.day)).toEqual(["2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});

describe("formatting", () => {
  test("words the practice time", () => {
    expect(formatPracticeTime(20_000)).toBe("under a minute");
    expect(formatPracticeTime(45 * 60_000)).toBe("45 min");
    expect(formatPracticeTime(125 * 60_000)).toBe("2 h 5 min");
    expect(formatPracticeTime(120 * 60_000)).toBe("2 h");
  });

  test("overall accuracy is null before any answer", () => {
    expect(overallAccuracy({ totalQuestions: 0, totalCorrect: 0 })).toBeNull();
    expect(overallAccuracy({ totalQuestions: 40, totalCorrect: 30 })).toBe(0.75);
  });

  test("day keys use the UTC calendar, as the server does", () => {
    expect(dayKey(new Date("2026-01-03T23:30:00Z"))).toBe("2026-01-03");
    expect(dayKey(new Date("2026-01-04T00:10:00+02:00"))).toBe("2026-01-03");
  });
});
