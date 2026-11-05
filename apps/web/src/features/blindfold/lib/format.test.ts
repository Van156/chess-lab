import { describe, expect, test } from "bun:test";

import { formatDuration, formatPercent, formatRelativeDay, formatSeconds } from "./format";

describe("formatDuration", () => {
  test("shows minutes and zero-padded seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5_400)).toBe("0:05");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(600_000)).toBe("10:00");
  });

  test("treats negative values as zero", () => {
    expect(formatDuration(-10)).toBe("0:00");
  });
});

describe("formatPercent", () => {
  test("rounds a fraction to a whole percent", () => {
    expect(formatPercent(0.85)).toBe("85%");
    expect(formatPercent(2 / 3)).toBe("67%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("formatSeconds", () => {
  test("shows seconds with one decimal", () => {
    expect(formatSeconds(4150)).toBe("4.2s");
    expect(formatSeconds(0)).toBe("0.0s");
    expect(formatSeconds(-3)).toBe("0.0s");
  });
});

describe("formatRelativeDay", () => {
  const now = new Date(2026, 10, 5, 9, 30);
  const daysBefore = (days: number, hour = 12) => new Date(2026, 10, 5 - days, hour);

  test("counts calendar days, not 24-hour spans", () => {
    expect(formatRelativeDay(new Date(2026, 10, 5, 0, 5), now)).toBe("Today");
    expect(formatRelativeDay(new Date(2026, 10, 4, 23, 50), now)).toBe("Yesterday");
    expect(formatRelativeDay(daysBefore(2), now)).toBe("2 days ago");
    expect(formatRelativeDay(daysBefore(6), now)).toBe("6 days ago");
  });

  test("rolls up to weeks, months and years", () => {
    expect(formatRelativeDay(daysBefore(7), now)).toBe("1 week ago");
    expect(formatRelativeDay(daysBefore(20), now)).toBe("2 weeks ago");
    expect(formatRelativeDay(daysBefore(45), now)).toBe("1 month ago");
    expect(formatRelativeDay(daysBefore(200), now)).toBe("6 months ago");
    expect(formatRelativeDay(daysBefore(800), now)).toBe("2 years ago");
  });

  test("accepts ISO strings and timestamps", () => {
    expect(formatRelativeDay(daysBefore(3).toISOString(), now.getTime())).toBe("3 days ago");
  });

  test("treats a future date as today and an invalid one as unknown", () => {
    expect(formatRelativeDay(new Date(2026, 10, 9), now)).toBe("Today");
    expect(formatRelativeDay("not a date", now)).toBeNull();
  });
});
