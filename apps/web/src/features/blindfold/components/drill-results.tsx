import { Button } from "@b2c-template/ui/components/button";

import { formatDuration, formatPercent } from "../lib/format";
import { accuracy, type SessionSummary } from "../lib/score";

export type DrillResultsProps = {
  label: string;
  summary: SessionSummary;
  onPlayAgain: () => void;
  onBack: () => void;
};

/** Outcome of a finished drill (presentational). */
export default function DrillResults({ label, summary, onPlayAgain, onBack }: DrillResultsProps) {
  return (
    <section aria-label={`${label} results`} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{label}: results</h2>
      <dl className="grid grid-cols-3 gap-4">
        <Stat term="Correct" value={`${summary.correct}/${summary.total}`} />
        <Stat term="Accuracy" value={formatPercent(accuracy(summary))} />
        <Stat term="Time" value={formatDuration(summary.durationMs)} />
      </dl>
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

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
