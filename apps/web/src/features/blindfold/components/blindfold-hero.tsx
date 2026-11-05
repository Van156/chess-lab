import { Button } from "@b2c-template/ui/components/button";
import { Skeleton } from "@b2c-template/ui/components/skeleton";
import { cn } from "@b2c-template/ui/lib/utils";
import { Play } from "lucide-react";

import { DRILL_CATEGORIES, type DrillInfo } from "../lib/drill-catalog";
import { formatPercent } from "../lib/format";
import {
  formatPracticeTime,
  practiceTimeParts,
  overallAccuracy,
  practiceStrip,
  STRIP_DAYS,
  type PracticeDay,
  type PracticeSummary,
} from "../lib/practice-summary";
import { describeLastPlayed } from "../lib/suggest-drill";
import DrillGlyph from "./drill-glyph";

export type HeroSuggestion = {
  drill: DrillInfo;
  /** When the suggested drill was last played; null or absent when never. */
  lastPlayedAt?: Date | string | null;
};

export type BlindfoldHeroProps = {
  /** All-time practice; absent while it loads or when it could not be loaded. */
  summary?: PracticeSummary;
  /** True while the summary loads: the numbers show placeholders. */
  pending?: boolean;
  /** The drill the call to action starts. */
  suggestion: HeroSuggestion | null;
  /** Today as `YYYY-MM-DD`, injected so the strip renders deterministically. */
  today: string;
  /** Starts the suggested drill. */
  onStart: () => void;
};

/**
 * Top of the Drills tab (presentational): the next drill to play with its call to action, and the
 * practice summary with a 28-day strip. A player with no sessions sees a short welcome instead.
 */
export default function BlindfoldHero({
  summary,
  pending = false,
  suggestion,
  today,
  onStart,
}: BlindfoldHeroProps) {
  const isNew = !pending && summary !== undefined && summary.totalSessions === 0;
  const practisedToday = summary?.practiceDays.some(
    (entry) => entry.day === today && entry.sessions > 0,
  );
  const cta = isNew
    ? "Start your first drill"
    : practisedToday
      ? "Continue training"
      : "Start today's drill";
  const category = DRILL_CATEGORIES.find((entry) => entry.id === suggestion?.drill.category);

  return (
    <section
      aria-labelledby="blindfold-hero-title"
      className="grid overflow-hidden rounded-2xl border bg-card md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {isNew ? (
          <div className="flex flex-col gap-2">
            <h2
              id="blindfold-hero-title"
              className="text-2xl font-semibold tracking-[-0.02em] text-balance"
            >
              Your first session takes two minutes
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              Short drills, no board. Each one trains a single skill, and your progress shows up
              here as you go.
            </p>
          </div>
        ) : (
          <h2 id="blindfold-hero-title" className="text-sm font-medium text-muted-foreground">
            {practisedToday ? "Keep going" : "Up next"}
          </h2>
        )}

        {suggestion ? (
          <div className="flex items-center gap-4">
            <DrillGlyph
              kind={suggestion.drill.kind}
              className="size-16 ring-1 ring-primary/30 sm:size-[72px]"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-xl font-semibold tracking-[-0.015em]">{suggestion.drill.label}</p>
              <p className="text-sm text-muted-foreground">
                {category ? `${category.label} · ` : null}
                {describeLastPlayed(suggestion.lastPlayedAt, today)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-xl px-5 text-[15px] font-semibold sm:w-auto"
            disabled={!suggestion}
            onClick={onStart}
          >
            <Play aria-hidden className="fill-current" />
            {cta}
          </Button>
          <span className="text-xs text-muted-foreground">Level 1 · about two minutes</span>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-6 border-t bg-background/40 p-5 sm:p-6 md:border-t-0 md:border-l">
        <PracticeStats summary={summary} pending={pending} />
        <PracticeStrip
          days={practiceStrip(summary?.practiceDays ?? [], today)}
          pending={pending}
          empty={isNew}
        />
      </div>
    </section>
  );
}

function PracticeStats({
  summary,
  pending,
}: {
  summary: PracticeSummary | undefined;
  pending: boolean;
}) {
  const accuracy = summary ? overallAccuracy(summary) : null;
  const streak = summary?.currentStreakDays ?? 0;
  const items: {
    label: string;
    value: string;
    unit?: string;
    highlight?: boolean;
    compact?: { value: number; unit: string }[];
  }[] = [
    {
      label: "Streak",
      value: summary ? String(streak) : "–",
      unit: streak === 1 ? "day" : "days",
      highlight: streak > 0,
    },
    { label: "Sessions", value: summary ? String(summary.totalSessions) : "–" },
    {
      label: "Practice time",
      value: summary ? formatPracticeTime(summary.totalDurationMs) : "–",
      compact: summary ? practiceTimeParts(summary.totalDurationMs) : undefined,
    },
    { label: "Accuracy", value: accuracy === null ? "–" : formatPercent(accuracy) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "flex items-baseline gap-1 text-xl font-semibold tracking-[-0.01em] tabular-nums",
              item.highlight && "text-primary",
            )}
          >
            {pending ? (
              <Skeleton className="h-7 w-14 rounded-md" />
            ) : (
              <>
                {item.compact ? (
                  <span className="flex items-baseline gap-1">
                    <span className="sr-only">{item.value}</span>
                    {item.compact.map((part) => (
                      <span key={part.unit} aria-hidden className="flex items-baseline gap-0.5">
                        {part.value}
                        <span className="text-sm font-medium text-muted-foreground">
                          {part.unit}
                        </span>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="truncate">{item.value}</span>
                )}
                {item.unit && summary ? (
                  <span className="text-sm font-medium text-muted-foreground">{item.unit}</span>
                ) : null}
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function labelDay(day: string): string {
  return DAY_LABEL.format(new Date(`${day}T00:00:00Z`));
}

function sessionsText(sessions: number): string {
  return sessions === 0 ? "no practice" : sessions === 1 ? "1 session" : `${sessions} sessions`;
}

/** Fill strength for a day: one session already reads clearly; three or more is full mint. */
function intensity(sessions: number): string {
  if (sessions >= 3) return "bg-primary";
  if (sessions === 2) return "bg-primary/75";
  return "bg-primary/50";
}

function PracticeStrip({
  days,
  pending,
  empty,
}: {
  days: PracticeDay[];
  pending: boolean;
  empty: boolean;
}) {
  const practised = days.filter((entry) => entry.sessions > 0).length;
  const first = days[0];
  const summaryText = `Practised on ${practised} of the last ${STRIP_DAYS} days`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">Last {STRIP_DAYS} days</span>
        <span className="text-muted-foreground tabular-nums">
          {pending
            ? "Loading"
            : empty
              ? "Your practice days light up here"
              : `${practised} of ${STRIP_DAYS} days`}
        </span>
      </div>
      <ol
        role="img"
        aria-label={pending ? "Practice days loading" : summaryText}
        className="grid grid-cols-14 gap-[3px]"
      >
        {days.map((entry, index) => {
          const today = index === days.length - 1;
          return (
            <li
              key={entry.day}
              title={`${labelDay(entry.day)}: ${sessionsText(entry.sessions)}`}
              className={cn(
                "aspect-square rounded-[4px]",
                entry.sessions > 0
                  ? intensity(entry.sessions)
                  : (index + Math.floor(index / 14)) % 2 === 0
                    ? "bg-[#3d5278]/50"
                    : "bg-[#8fa3c4]/15",
                today && "ring-1 ring-foreground/70 ring-offset-1 ring-offset-card",
                pending && "motion-safe:animate-pulse",
              )}
            />
          );
        })}
      </ol>
      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{first ? labelDay(first.day) : null}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
