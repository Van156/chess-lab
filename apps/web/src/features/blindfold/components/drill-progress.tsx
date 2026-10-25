import { Card, CardContent, CardHeader, CardTitle } from "@b2c-template/ui/components/card";

import type { DrillInfo } from "../lib/drill-catalog";
import { hasAnySessions, recentAccuracies, type DrillStat } from "../lib/drill-stats";
import { formatPercent } from "../lib/format";

export type DrillProgressProps = {
  drills: readonly DrillInfo[];
  stats: readonly DrillStat[];
};

/** Progress for every drill (presentational): sessions, best accuracy and a recent trend. */
export default function DrillProgress({ drills, stats }: DrillProgressProps) {
  return (
    <section aria-labelledby="blindfold-progress" className="flex flex-col gap-3">
      <h2 id="blindfold-progress" className="text-lg font-semibold">
        Your progress
      </h2>
      {hasAnySessions(stats) ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {drills.map((drill) => {
            const stat = stats.find((entry) => entry.drill === drill.kind);
            return stat ? (
              <li key={drill.kind}>
                <DrillProgressCard label={drill.label} stat={stat} />
              </li>
            ) : null;
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No sessions yet. Finish a drill and your best accuracy and recent sessions show up here.
        </p>
      )}
    </section>
  );
}

function DrillProgressCard({ label, stat }: { label: string; stat: DrillStat }) {
  const points = recentAccuracies(stat.recent);
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Sessions</dt>
            <dd className="text-lg font-semibold tabular-nums">{stat.sessions}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Best accuracy</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {stat.bestAccuracy === null ? "–" : formatPercent(stat.bestAccuracy)}
            </dd>
          </div>
        </dl>
        {points.length > 0 ? (
          <div>
            <p className="text-sm text-muted-foreground">Recent sessions, oldest first</p>
            <ol aria-label={`${label} recent accuracy`} className="flex h-12 items-end gap-1">
              {points.map((point) => (
                <li
                  key={point.id}
                  className="flex-1 rounded-t-sm bg-primary"
                  style={{ height: `${Math.max(point.accuracy * 100, 4)}%` }}
                >
                  <span className="sr-only">{formatPercent(point.accuracy)}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
