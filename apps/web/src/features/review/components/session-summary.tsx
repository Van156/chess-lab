import { Card } from "@b2c-template/ui/components/card";
import { cn } from "@b2c-template/ui/lib/utils";
import type { ReactNode } from "react";

import { formatSessionTime } from "../lib/session-format";
import type { SessionSummary as Summary } from "../lib/review-queue";
import { GRADE_OPTIONS } from "./review-card-view";

/** End of the queue: what was reviewed, how it was graded, and the way onward (slot). */
export default function SessionSummary({
  summary,
  action,
}: {
  summary: Summary;
  /** The "Back to Today" link; the container owns routing. */
  action: ReactNode;
}) {
  const empty = summary.answers === 0;
  return (
    <Card
      role="region"
      aria-labelledby="review-summary-title"
      className="items-start gap-4 rounded-2xl p-4 md:p-6"
    >
      <h2 id="review-summary-title" className="text-3xl font-bold">
        {empty ? "Nothing to review" : "Session complete"}
      </h2>
      {empty ? (
        <p className="text-muted-foreground">
          No cards are due right now. Check Today for what is next.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground">
            {summary.cards} {summary.cards === 1 ? "card" : "cards"} reviewed in{" "}
            {formatSessionTime(summary.durationMs)}.
          </p>
          <dl className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            {GRADE_OPTIONS.map((option) => (
              <div key={option.grade} className={cn("rounded-2xl border p-3", option.className)}>
                <dt className="text-sm font-medium">{option.label}</dt>
                <dd className="text-2xl font-bold">{summary.byGrade[option.grade]}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {action}
    </Card>
  );
}
