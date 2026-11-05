import { cn } from "@b2c-template/ui/lib/utils";
import { ChartNoAxesColumn } from "lucide-react";

import type { DrillInfo } from "../lib/drill-catalog";
import {
  groupDrillsByCategory,
  hasAnySessions,
  recentAccuracies,
  statFor,
  totals,
  trendSummary,
  type DrillStat,
} from "../lib/drill-stats";
import { formatPercent, formatRelativeDay } from "../lib/format";
import Sparkline from "./sparkline";

export type DrillProgressProps = {
  drills: readonly DrillInfo[];
  stats: readonly DrillStat[];
  /** The reference time for "last played"; defaults to the current time. */
  now?: number | Date;
};

/** Shared column layout for the header and every row, from `sm` up. */
const COLUMNS =
  "sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_7.5rem_6.5rem] sm:items-center sm:gap-x-4";

/** Progress for every drill (presentational), grouped by category: sessions, best, last played and a trend. */
export default function DrillProgress({ drills, stats, now = Date.now() }: DrillProgressProps) {
  const played = hasAnySessions(stats);
  const { sessions, drillsPlayed } = totals(stats);
  return (
    <section aria-labelledby="blindfold-progress" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="blindfold-progress" className="text-lg font-semibold tracking-tight">
          Your progress
        </h2>
        {played ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {sessions} {sessions === 1 ? "session" : "sessions"} · {drillsPlayed} of {drills.length}{" "}
            drills started
          </p>
        ) : null}
      </div>
      {played ? (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div
            aria-hidden="true"
            className={cn(
              "hidden border-b px-5 py-2.5 text-xs text-muted-foreground sm:grid",
              COLUMNS,
            )}
          >
            <span>Drill</span>
            <span className="text-right">Sessions</span>
            <span className="text-right">Best</span>
            <span>Last played</span>
            <span>Recent</span>
          </div>
          {groupDrillsByCategory(drills).map(({ category, drills: inCategory }) => (
            <section
              key={category.id}
              aria-labelledby={`blindfold-progress-${category.id}`}
              className="border-b last:border-b-0"
            >
              <h3
                id={`blindfold-progress-${category.id}`}
                className="bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:px-5"
              >
                {category.label}
              </h3>
              <ul className="divide-y divide-border/60">
                {inCategory.map((drill) => (
                  <li key={drill.kind}>
                    <DrillRow drill={drill} stat={statFor(stats, drill.kind)} now={now} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyProgress />
      )}
    </section>
  );
}

function DrillRow({
  drill,
  stat,
  now,
}: {
  drill: DrillInfo;
  stat: DrillStat | undefined;
  now: number | Date;
}) {
  const name = <p className="truncate text-sm font-medium">{drill.label}</p>;
  if (!stat || stat.sessions === 0) {
    return (
      <div
        className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-3 sm:px-5", COLUMNS)}
      >
        {name}
        <p className="text-xs text-muted-foreground sm:col-span-4">Not started</p>
      </div>
    );
  }
  const points = recentAccuracies(stat.recent);
  const lastPlayed = stat.lastPlayedAt ? formatRelativeDay(stat.lastPlayedAt, now) : null;
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5",
        COLUMNS,
      )}
    >
      {name}
      <dl className="col-start-1 row-start-2 flex flex-wrap gap-x-2 text-xs text-muted-foreground sm:contents sm:text-sm">
        <div className="sm:text-right">
          <dt className="sr-only">Sessions</dt>
          <dd className="tabular-nums sm:text-foreground">
            <span>{stat.sessions}</span>
            <span className="sm:hidden"> {stat.sessions === 1 ? "session" : "sessions"}</span>
          </dd>
        </div>
        <span aria-hidden="true" className="sm:hidden">
          ·
        </span>
        <div className="sm:text-right">
          <dt className="sr-only">Best accuracy</dt>
          <dd className="tabular-nums">
            <span className="sm:hidden">Best </span>
            <span className="font-medium text-foreground">
              {stat.bestAccuracy === null ? "–" : formatPercent(stat.bestAccuracy)}
            </span>
          </dd>
        </div>
        <div className="basis-full sm:basis-auto">
          <dt className="sr-only">Last played</dt>
          <dd className="sm:text-muted-foreground">{lastPlayed ?? "–"}</dd>
        </div>
      </dl>
      <div className="col-start-2 row-span-2 row-start-1 sm:col-start-auto sm:row-span-1 sm:row-start-auto">
        <Sparkline
          values={points.map((point) => point.accuracy)}
          summary={`${drill.label} recent accuracy. ${trendSummary(points)}`}
        />
      </div>
    </div>
  );
}

function EmptyProgress() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed bg-card/50 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      <MiniBoard />
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 font-medium">
          <ChartNoAxesColumn aria-hidden="true" className="size-4 text-primary" />
          No sessions yet
        </p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Finish any drill and it appears here with your best accuracy, when you last played and a
          trend of recent sessions. Square colour takes about a minute.
        </p>
      </div>
    </div>
  );
}

/** A 4×4 corner of the board, one square lit: a quiet nod to what the drills train. */
function MiniBoard() {
  return (
    <svg aria-hidden="true" viewBox="0 0 4 4" className="size-14 shrink-0 rounded-lg">
      {Array.from({ length: 16 }, (_, index) => {
        const file = index % 4;
        const rank = Math.floor(index / 4);
        const light = (file + rank) % 2 === 0;
        const lit = file === 2 && rank === 1;
        return (
          <rect
            key={index}
            x={file}
            y={rank}
            width={1}
            height={1}
            fill={lit ? "var(--primary)" : light ? "#8fa3c4" : "#3d5278"}
            opacity={lit ? 1 : 0.55}
          />
        );
      })}
    </svg>
  );
}
