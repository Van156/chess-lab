import { Button } from "@b2c-template/ui/components/button";

import type { SaveStatus } from "../hooks/use-save-session";
import { formatDuration, formatPercent } from "../lib/format";
import { accuracy, type SessionSummary } from "../lib/score";

export type DrillResultsProps = {
  label: string;
  summary: SessionSummary;
  /** Where saving the result stands; `null` before the save starts. */
  saveStatus: SaveStatus | null;
  onRetrySave: () => void;
  onPlayAgain: () => void;
  onBack: () => void;
};

/** Outcome of a finished drill (presentational), with the state of saving it. */
export default function DrillResults({
  label,
  summary,
  saveStatus,
  onRetrySave,
  onPlayAgain,
  onBack,
}: DrillResultsProps) {
  return (
    <section aria-label={`${label} results`} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{label}: results</h2>
      <dl className="grid grid-cols-3 gap-4">
        <Stat term="Correct" value={`${summary.correct}/${summary.total}`} />
        <Stat term="Accuracy" value={formatPercent(accuracy(summary))} />
        <Stat term="Time" value={formatDuration(summary.durationMs)} />
      </dl>
      <SaveState status={saveStatus} onRetry={onRetrySave} />
      <div className="flex gap-2">
        <Button type="button" onClick={onPlayAgain}>
          Play again
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          Back to drills
        </Button>
      </div>
    </section>
  );
}

function SaveState({ status, onRetry }: { status: SaveStatus | null; onRetry: () => void }) {
  if (status === "error") {
    return (
      <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
        Your result could not be saved.
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (status === "saved") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Result saved.
      </p>
    );
  }
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Saving your result…
    </p>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
