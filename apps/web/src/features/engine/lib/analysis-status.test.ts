import { describe, expect, test } from "bun:test";

import {
  describeStatus,
  initialStatus,
  isReviewPath,
  reduceStatus,
  type AnalysisEvent,
  type AnalysisStatus,
} from "./analysis-status";

const run = (events: AnalysisEvent[], from: AnalysisStatus = initialStatus) =>
  events.reduce(reduceStatus, from);

describe("reduceStatus", () => {
  test("starts running with unknown progress", () => {
    expect(run([{ type: "started" }])).toEqual({
      phase: "running",
      stage: "screen",
      done: 0,
      total: 0,
      analysed: 0,
    });
  });

  test("tracks progress and counts completed games", () => {
    const status = run([
      { type: "started" },
      { type: "progress", stage: "confirm", done: 2, total: 5 },
      { type: "gameCompleted" },
    ]);
    expect(status).toMatchObject({ phase: "running", stage: "confirm", done: 2, analysed: 1 });
  });

  test("pausing keeps progress and resuming continues it", () => {
    const paused = run([
      { type: "started" },
      { type: "progress", stage: "screen", done: 4, total: 9 },
      { type: "paused" },
      { type: "progress", stage: "screen", done: 4, total: 9 },
    ]);
    expect(paused).toMatchObject({ phase: "paused", done: 4, total: 9 });
    expect(reduceStatus(paused, { type: "resumed" })).toMatchObject({ phase: "running", done: 4 });
  });

  test("pause and resume are ignored when nothing is running", () => {
    expect(reduceStatus(initialStatus, { type: "paused" })).toEqual(initialStatus);
    expect(reduceStatus({ phase: "stopped", analysed: 0 }, { type: "resumed" })).toEqual({
      phase: "stopped",
      analysed: 0,
    });
  });

  test("stop reasons keep the analysed count", () => {
    const status = run([{ type: "started" }, { type: "gameCompleted" }, { type: "unavailable" }]);
    expect(status).toEqual({ phase: "unavailable", analysed: 1 });
  });

  test("finishing with no games analysed shows nothing", () => {
    expect(run([{ type: "started" }, { type: "finished" }])).toEqual({ phase: "idle" });
    expect(run([{ type: "started" }, { type: "gameCompleted" }, { type: "finished" }])).toEqual({
      phase: "finished",
      analysed: 1,
    });
  });

  test("a restart after a stop keeps the analysed count", () => {
    const status = run([{ type: "started" }], { phase: "stopped", analysed: 2 });
    expect(status).toMatchObject({ phase: "running", analysed: 2 });
  });
});

describe("describeStatus", () => {
  test("idle shows nothing", () => {
    expect(describeStatus({ phase: "idle" })).toBeNull();
  });

  test("running reports progress as a percentage", () => {
    const d = describeStatus({
      phase: "running",
      stage: "screen",
      done: 15,
      total: 60,
      analysed: 0,
    });
    expect(d?.message).toContain("15 of 60");
    expect(d?.progress).toBe(25);
    expect(d?.canResume).toBe(false);
  });

  test("running with no total yet is indeterminate", () => {
    const d = describeStatus({ phase: "running", stage: "screen", done: 0, total: 0, analysed: 0 });
    expect(d).toMatchObject({ message: "Preparing analysis", progress: null });
  });

  test("paused explains the review and offers no resume", () => {
    const d = describeStatus({ phase: "paused", stage: "screen", done: 1, total: 4, analysed: 0 });
    expect(d?.message).toContain("paused while you review");
    expect(d?.canResume).toBe(false);
  });

  test("stopped, unavailable and failed offer resume", () => {
    for (const phase of ["stopped", "unavailable", "failed"] as const) {
      expect(describeStatus({ phase, analysed: 0 })?.canResume).toBe(true);
    }
    expect(describeStatus({ phase: "unavailable", analysed: 0 })?.message).toContain(
      "Engine unavailable",
    );
  });

  test("finished counts the games", () => {
    expect(describeStatus({ phase: "finished", analysed: 1 })?.message).toContain(
      "1 game analysed",
    );
    expect(describeStatus({ phase: "finished", analysed: 3 })?.message).toContain("3 games");
  });
});

describe("isReviewPath", () => {
  test("matches the review route and its children only", () => {
    expect(isReviewPath("/review")).toBe(true);
    expect(isReviewPath("/review/abc")).toBe(true);
    expect(isReviewPath("/reviews")).toBe(false);
    expect(isReviewPath("/today")).toBe(false);
  });
});
