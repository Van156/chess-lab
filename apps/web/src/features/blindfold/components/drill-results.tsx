import { Button } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { Check, CloudCheck, LoaderCircle, RotateCcw, Trophy, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import type { SaveStatus } from "../hooks/use-save-session";
import { formatDuration, formatPercent, formatSeconds } from "../lib/format";
import {
  accuracy,
  averageMsPerQuestion,
  isPersonalBest,
  longestRun,
  verdictFor,
  type SessionSummary,
} from "../lib/score";
import type { ReviewItem } from "../lib/session-review";
import AccuracyRing from "./accuracy-ring";

export type DrillResultsProps = {
  label: string;
  summary: SessionSummary;
  /** Where saving the result stands; `null` before the save starts. */
  saveStatus: SaveStatus | null;
  onRetrySave: () => void;
  onPlayAgain: () => void;
  onBack: () => void;
  /** Best accuracy before this session; a higher score shows the personal best callout. */
  previousBest?: number | null;
  /** Per-question results, for the best streak; taken from `review` when missing. */
  results?: readonly boolean[];
  /** Every answered question, for the review list (see `buildReview`). */
  review?: readonly ReviewItem[];
};

/** Outcome of a finished drill (presentational), with the state of saving it. */
export default function DrillResults({
  label,
  summary,
  saveStatus,
  onRetrySave,
  onPlayAgain,
  onBack,
  previousBest,
  results,
  review,
}: DrillResultsProps) {
  const fraction = accuracy(summary);
  const verdict = verdictFor(fraction);
  const newBest = isPersonalBest(fraction, previousBest);
  const runs = results ?? review?.map((item) => item.correct);
  const titleId = "drill-results-title";

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:items-center sm:gap-8 sm:p-8 sm:text-left">
          <AccuracyRing value={fraction} />
          <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
            <p className="text-sm text-muted-foreground">{label}</p>
            <h2 id={titleId} className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {verdict.label}
              <span className="sr-only">: {label} results</span>
            </h2>
            <p className="text-muted-foreground">{verdict.message}</p>
            {newBest ? (
              <p className="mt-1 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-1 pr-3 pl-2 text-sm font-medium text-primary">
                <Trophy aria-hidden="true" className="size-4" />
                New personal best
                <span className="text-primary/80 tabular-nums">
                  (was {formatPercent(previousBest ?? 0)})
                </span>
              </p>
            ) : typeof previousBest === "number" ? (
              <p className="text-sm text-muted-foreground tabular-nums">
                Your best: {formatPercent(Math.max(previousBest, fraction))}
              </p>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t sm:grid-cols-4">
          <Stat term="Correct" value={`${summary.correct}/${summary.total}`} />
          <Stat term="Time" value={formatDuration(summary.durationMs)} />
          <Stat term="Per question" value={formatSeconds(averageMsPerQuestion(summary))} />
          <Stat term="Best streak" value={runs ? String(longestRun(runs)) : "–"} />
        </dl>
        <div className="flex flex-col-reverse gap-4 border-t bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <SaveState status={saveStatus} onRetry={onRetrySave} />
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="button" onClick={onPlayAgain}>
              <RotateCcw aria-hidden="true" data-icon="inline-start" />
              Play again
            </Button>
            <Button type="button" variant="outline" onClick={onBack}>
              Back to drills
            </Button>
          </div>
        </div>
      </div>
      {review && review.length > 0 ? <ReviewList items={review} /> : null}
    </section>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-border px-5 py-4 not-last:border-r max-sm:nth-2:border-r-0 max-sm:nth-[-n+2]:border-b sm:px-8">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

function SaveState({ status, onRetry }: { status: SaveStatus | null; onRetry: () => void }) {
  if (status === "error") {
    return (
      <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        Your result could not be saved.
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (status === "saved") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <CloudCheck aria-hidden="true" className="size-4 text-primary" />
        Result saved.
      </p>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
      Saving your result…
    </p>
  );
}

function ReviewList({ items }: { items: readonly ReviewItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const mistakes = items.filter((item) => !item.correct).length;
  const visible = items
    .map((item, index) => ({ item, number: index + 1 }))
    .filter(({ item }) => showAll || !item.correct);

  return (
    <section aria-labelledby="drill-review-title" className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 sm:px-8">
        <div>
          <h3 id="drill-review-title" className="font-semibold tracking-tight">
            Question review
          </h3>
          <p className="text-sm text-muted-foreground tabular-nums">
            {mistakes === 0
              ? "No mistakes this time."
              : `${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"} to look over.`}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={showAll}
          aria-controls="drill-review-list"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Mistakes only" : `Show all ${items.length}`}
        </Button>
      </div>
      {visible.length > 0 ? (
        <ol id="drill-review-list" className="divide-y divide-border/60">
          {visible.map(({ item, number }) => (
            <ReviewRow key={number} item={item} number={number} />
          ))}
        </ol>
      ) : (
        <p id="drill-review-list" className="px-5 py-4 text-sm text-muted-foreground sm:px-8">
          Every answer was right. Show all to see them.
        </p>
      )}
    </section>
  );
}

function ReviewRow({ item, number }: { item: ReviewItem; number: number }) {
  const Icon = item.correct ? Check : X;
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-x-3 gap-y-2 px-5 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:px-8">
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full",
          item.correct ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
        <span className="sr-only">{item.correct ? "Correct" : "Wrong"}</span>
      </span>
      <p className="min-w-0 self-center text-sm">
        <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">
          {String(number).padStart(2, "0")}
        </span>
        {item.prompt}
      </p>
      <dl className="col-start-2 flex flex-wrap items-center gap-2 text-sm sm:col-start-3 sm:justify-end">
        {item.correct ? null : (
          <div className="flex items-center gap-1.5">
            <dt className="text-xs text-muted-foreground">You</dt>
            <dd className="rounded-md bg-destructive/10 px-1.5 py-0.5 font-mono text-destructive line-through decoration-destructive/50">
              {item.given}
            </dd>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <dt className="text-xs text-muted-foreground">{item.correct ? "Answer" : "Right"}</dt>
          <dd className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground">
            {item.expected}
          </dd>
        </div>
      </dl>
    </li>
  );
}
