import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { FINISHED_SUMMARY } from "./drill-player.fixtures";
import DrillResults, { type DrillResultsProps } from "./drill-results";
import { knightReview, PERFECT_SUMMARY, RESULTS } from "./drill-results.fixtures";

const noop = () => {};

function render(props: Partial<DrillResultsProps> = {}) {
  return renderWithRouter(
    <DrillResults
      label="Knight distance"
      summary={FINISHED_SUMMARY}
      saveStatus="saved"
      onRetrySave={noop}
      onPlayAgain={noop}
      onBack={noop}
      {...props}
    />,
  );
}

describe("DrillResults", () => {
  test("shows the ring, the verdict and every stat tile", async () => {
    const html = await render({ results: RESULTS });
    expect(html).toContain(">85%<");
    expect(html).toContain(">Solid<");
    expect(html).toContain(">17/20<");
    expect(html).toContain(">1:23<");
    expect(html).toContain(">4.2s<");
    // Misses at 4, 12 and 13: the longest run is questions 5 to 11.
    expect(html).toContain(
      'Best streak</dt><dd class="text-2xl font-semibold tracking-tight tabular-nums">7<',
    );
    expect(html).toContain('aria-labelledby="drill-results-title"');
    expect(html).toContain("Knight distance results");
  });

  test("keeps the old props working, with a dash for an unknown streak", async () => {
    const html = await render();
    expect(html).toContain("Best streak</dt>");
    expect(html).toContain(">–<");
    expect(html).not.toContain("New personal best");
    expect(html).not.toContain("Question review");
  });

  test("calls out a new personal best only when the earlier best is beaten", async () => {
    expect(await render({ previousBest: 0.7 })).toContain("New personal best");
    expect(await render({ previousBest: 0.7 })).toContain("(was 70%)");
    expect(await render({ previousBest: 0.85 })).not.toContain("New personal best");
    expect(await render({ previousBest: null })).not.toContain("New personal best");
  });

  test("names a perfect score Flawless", async () => {
    const html = await render({ summary: PERFECT_SUMMARY });
    expect(html).toContain(">Flawless<");
    expect(html).toContain(">100%<");
  });

  test("keeps the save states and their roles", async () => {
    const saved = await render();
    expect(saved).toContain('role="status"');
    expect(saved).toContain("Result saved.");
    const saving = await render({ saveStatus: "saving" });
    expect(saving).toContain("Saving your result");
    expect(saving).not.toContain(">Retry<");
    const failed = await render({ saveStatus: "error" });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("could not be saved");
    expect(failed).toContain(">Retry<");
    expect(failed).toContain("Play again");
    expect(failed).toContain("Back to drills");
  });

  test("reviews only the mistakes by default, with a toggle to show all", async () => {
    const review = knightReview();
    const html = await render({ review });
    expect(html).toContain("Question review");
    expect(html).toContain("3 mistakes to look over.");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain(">Show all 20<");
    expect(html.match(/>Wrong</g)).toHaveLength(3);
    expect(html).not.toContain('sr-only">Correct<');
    const miss = review.find((item) => !item.correct)!;
    expect(html).toContain(`>${miss.given}<`);
    expect(html).toContain(`>${miss.expected}<`);
  });

  test("says so when there were no mistakes to review", async () => {
    const html = await render({
      summary: PERFECT_SUMMARY,
      review: knightReview(Array.from({ length: 20 }, () => true)),
    });
    expect(html).toContain("No mistakes this time.");
    expect(html).toContain("Every answer was right.");
  });
});
