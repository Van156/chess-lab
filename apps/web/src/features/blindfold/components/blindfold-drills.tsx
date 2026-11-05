import { Button } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { DRILL_CATEGORIES, type DrillInfo } from "../lib/drill-catalog";
import type { DrillStat } from "../lib/drill-stats";
import { formatPercent } from "../lib/format";
import type { DrillKind } from "../lib/questions";
import DrillGlyph from "./drill-glyph";

export const DRILL_LEVELS = [1, 2, 3] as const;
export const DEFAULT_LEVEL = 1;

/** What each level changes, shown under its number in the level control. */
export const LEVEL_HINTS: Record<(typeof DRILL_LEVELS)[number], string> = {
  1: "Half board",
  2: "Full board",
  3: "Expert",
};

export type BlindfoldDrillsProps = {
  drills: readonly DrillInfo[];
  onStart: (kind: DrillKind, level: number) => void;
  /** Per-drill progress; drills without a stat (or before it loads) show no record. */
  stats?: readonly DrillStat[];
  /** The drill the hero suggests, marked on its card. */
  suggestedKind?: DrillKind;
};

/**
 * Drill picker (presentational): the drills grouped by category, one card each with a glyph, an
 * example, the player's record, a level control and Start. The whole card starts the drill.
 */
export default function BlindfoldDrills({
  drills,
  onStart,
  stats,
  suggestedKind,
}: BlindfoldDrillsProps) {
  const [levels, setLevels] = useState<Partial<Record<DrillKind, number>>>({});
  const groups = DRILL_CATEGORIES.map((category) => ({
    category,
    drills: drills.filter((drill) => drill.category === category.id),
  })).filter((group) => group.drills.length > 0);

  return (
    <div aria-label="Drills" role="region" className="flex flex-col gap-10">
      {groups.map(({ category, drills: inCategory }) => {
        const headingId = `drills-${category.id}`;
        return (
          <section key={category.id} aria-labelledby={headingId} className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <h2 id={headingId} className="text-base font-semibold tracking-[-0.01em]">
                  {category.label}
                </h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {inCategory.length} {inCategory.length === 1 ? "drill" : "drills"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{category.description}</p>
            </header>
            <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {inCategory.map((drill) => (
                <li key={drill.kind}>
                  <DrillCard
                    drill={drill}
                    stat={stats?.find((entry) => entry.drill === drill.kind)}
                    level={levels[drill.kind] ?? DEFAULT_LEVEL}
                    suggested={drill.kind === suggestedKind}
                    onLevel={(level) =>
                      setLevels((current) => ({ ...current, [drill.kind]: level }))
                    }
                    onStart={onStart}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** One drill card (presentational; exported for tests). */
export function DrillCard({
  drill,
  stat,
  level,
  suggested,
  onLevel,
  onStart,
}: {
  drill: DrillInfo;
  stat: DrillStat | undefined;
  level: number;
  suggested: boolean;
  onLevel: (level: number) => void;
  onStart: (kind: DrillKind, level: number) => void;
}) {
  const played = stat !== undefined && stat.sessions > 0;
  return (
    <article
      className={cn(
        "group/drill relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5",
        "motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-150",
        "hover:border-primary/40 hover:bg-[color-mix(in_oklch,var(--card),var(--primary)_3%)]",
        "has-[[data-start]:focus-visible]:border-primary has-[[data-start]:focus-visible]:ring-3 has-[[data-start]:focus-visible]:ring-ring/40",
      )}
    >
      <div className="flex items-start gap-3.5">
        <DrillGlyph
          kind={drill.kind}
          className="size-14 ring-1 ring-border motion-safe:transition-[box-shadow] group-hover/drill:ring-primary/40"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-semibold tracking-[-0.01em]">{drill.label}</h3>
            {suggested ? (
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                Suggested
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-snug text-muted-foreground">{drill.description}</p>
        </div>
      </div>

      <figure className="flex flex-col gap-1">
        <figcaption className="sr-only">Example</figcaption>
        <blockquote className="rounded-lg border-l-2 border-primary/60 bg-background/70 px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground/90">
          {drill.example}
        </blockquote>
      </figure>

      <DrillRecord stat={played ? stat : undefined} />

      <div className="mt-auto flex items-stretch gap-2">
        <div
          role="group"
          aria-label={`${drill.label} level`}
          className="relative z-10 grid min-w-0 flex-1 grid-cols-3 gap-0.5 rounded-xl bg-muted p-0.5"
        >
          {DRILL_LEVELS.map((option) => {
            const active = option === level;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => onLevel(option)}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center rounded-[10px] px-1 py-1.5 leading-tight outline-none",
                  "motion-safe:transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-card text-foreground shadow-sm ring-1 ring-primary/50"
                    : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
                )}
              >
                <span className="text-xs font-semibold">Level {option}</span>
                <span
                  className={cn(
                    "truncate text-[11px]",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {LEVEL_HINTS[option]}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          data-start=""
          className="h-auto min-h-11 rounded-xl px-4 font-semibold after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:ring-0"
          onClick={() => onStart(drill.kind, level)}
        >
          Start
          <span className="sr-only"> {drill.label}</span>
          <ArrowRight
            aria-hidden
            className="motion-safe:transition-transform group-hover/drill:translate-x-0.5"
          />
        </Button>
      </div>
    </article>
  );
}

function DrillRecord({ stat }: { stat: DrillStat | undefined }) {
  if (!stat) {
    return <p className="text-xs text-muted-foreground">Not played yet</p>;
  }
  return (
    <dl className="flex items-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-baseline gap-1.5">
        <dt>Best</dt>
        <dd className="font-semibold text-foreground tabular-nums">
          {stat.bestAccuracy === null ? "–" : formatPercent(stat.bestAccuracy)}
        </dd>
      </div>
      <div className="flex items-baseline gap-1.5">
        <dt>Sessions</dt>
        <dd className="font-semibold text-foreground tabular-nums">{stat.sessions}</dd>
      </div>
    </dl>
  );
}
