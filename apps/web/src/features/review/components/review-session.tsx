import type { Grade } from "@b2c-template/study";
import { Button } from "@b2c-template/ui/components/button";
import { Progress } from "@b2c-template/ui/components/progress";
import type { ReactNode } from "react";

import type { SessionPhase, SessionSummary as Summary } from "../lib/review-queue";
import type { QueueItem } from "../lib/review-types";
import ReviewCard from "./review-card";
import SessionSummary from "./session-summary";

export type ReviewSessionProps = {
  phase: SessionPhase;
  card: QueueItem | null;
  progress: { done: number; total: number };
  summary: Summary;
  onGrade: (grade: Grade) => void;
  onRetryPage: () => void;
  /** Shown with the summary at the end of the session (a link back to Today). */
  doneAction: ReactNode;
};

/** The review screen for every phase of a session; all data and actions arrive as props. */
export default function ReviewSession({
  phase,
  card,
  progress,
  summary,
  onGrade,
  onRetryPage,
  doneAction,
}: ReviewSessionProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Review session</h1>
        {phase !== "done" ? (
          <Progress
            value={progress.done}
            max={Math.max(progress.total, 1)}
            aria-label={`Review progress: ${progress.done} of ${progress.total} answered`}
          />
        ) : null}
      </header>

      {phase === "card" && card ? (
        // Keyed by card so each card starts unrevealed; the board component stays mounted.
        <ReviewCard key={`${card.cardId}-${progress.done}`} card={card} onGrade={onGrade} />
      ) : null}

      {phase === "waiting" ? (
        <p role="status" className="text-muted-foreground">
          Loading more cards...
        </p>
      ) : null}

      {phase === "failed" ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>More cards could not be loaded. Your grades so far are saved.</p>
          <Button type="button" className="min-h-11 px-6" onClick={onRetryPage}>
            Try again
          </Button>
        </div>
      ) : null}

      {phase === "done" ? <SessionSummary summary={summary} action={doneAction} /> : null}
    </div>
  );
}
