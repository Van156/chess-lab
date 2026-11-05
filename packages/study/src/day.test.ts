import { describe, expect, test } from "bun:test";

import { localDayBounds } from "./day";

const iso = (d: Date) => d.toISOString();
const hours = (b: { start: Date; end: Date }) => (b.end.getTime() - b.start.getTime()) / 3_600_000;

describe("localDayBounds", () => {
  test("UTC day is midnight to midnight", () => {
    const b = localDayBounds(new Date("2026-03-10T15:30:00Z"), "UTC");
    expect(iso(b.start)).toBe("2026-03-10T00:00:00.000Z");
    expect(iso(b.end)).toBe("2026-03-11T00:00:00.000Z");
  });

  test("a fixed offset zone shifts the bounds", () => {
    // 02:00Z on the 10th is still the 9th in New York (EST, -5).
    const b = localDayBounds(new Date("2026-02-10T02:00:00Z"), "America/New_York");
    expect(iso(b.start)).toBe("2026-02-09T05:00:00.000Z");
    expect(iso(b.end)).toBe("2026-02-10T05:00:00.000Z");
  });

  test("now is inside [start, end) and bounds are start-inclusive", () => {
    const now = new Date("2026-02-10T05:00:00Z");
    const b = localDayBounds(now, "America/New_York");
    expect(iso(b.start)).toBe("2026-02-10T05:00:00.000Z");
    expect(b.start.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(now.getTime()).toBeLessThan(b.end.getTime());
  });

  test("spring-forward day is 23 hours long", () => {
    const b = localDayBounds(new Date("2026-03-08T18:00:00Z"), "America/New_York");
    expect(iso(b.start)).toBe("2026-03-08T05:00:00.000Z");
    expect(iso(b.end)).toBe("2026-03-09T04:00:00.000Z");
    expect(hours(b)).toBe(23);
  });

  test("fall-back day is 25 hours long", () => {
    const b = localDayBounds(new Date("2026-11-01T18:00:00Z"), "America/New_York");
    expect(iso(b.start)).toBe("2026-11-01T04:00:00.000Z");
    expect(iso(b.end)).toBe("2026-11-02T05:00:00.000Z");
    expect(hours(b)).toBe(25);
  });

  test("half-hour zone (Asia/Kolkata, +05:30)", () => {
    const b = localDayBounds(new Date("2026-03-10T20:00:00Z"), "Asia/Kolkata");
    // 20:00Z is 01:30 on the 11th local.
    expect(iso(b.start)).toBe("2026-03-10T18:30:00.000Z");
    expect(iso(b.end)).toBe("2026-03-11T18:30:00.000Z");
  });

  test("45-minute zone (Asia/Kathmandu, +05:45)", () => {
    const b = localDayBounds(new Date("2026-03-10T12:00:00Z"), "Asia/Kathmandu");
    expect(iso(b.start)).toBe("2026-03-09T18:15:00.000Z");
    expect(iso(b.end)).toBe("2026-03-10T18:15:00.000Z");
  });

  test("Lord Howe (30-minute DST shift) day is 23.5 hours long", () => {
    // DST starts 2026-10-04 02:00 local (+10:30 to +11:00).
    const b = localDayBounds(new Date("2026-10-04T05:00:00Z"), "Australia/Lord_Howe");
    expect(hours(b)).toBe(23.5);
  });

  test("a zone whose DST gap swallows local midnight starts at the first valid instant", () => {
    // America/Santiago 2026-09-06: 00:00 jumps to 01:00 (-04 to -03).
    const b = localDayBounds(new Date("2026-09-06T12:00:00Z"), "America/Santiago");
    expect(iso(b.start)).toBe("2026-09-06T04:00:00.000Z");
    expect(hours(b)).toBe(23);
  });

  test("consecutive days tile without gaps", () => {
    const a = localDayBounds(new Date("2026-03-08T12:00:00Z"), "America/New_York");
    const b = localDayBounds(a.end, "America/New_York");
    expect(iso(b.start)).toBe(iso(a.end));
  });

  test("rejects an unknown time zone", () => {
    expect(() => localDayBounds(new Date(), "Mars/Olympus")).toThrow();
  });
});
