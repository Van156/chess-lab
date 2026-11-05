import { cn } from "@b2c-template/ui/lib/utils";

import { formatPercent } from "../lib/format";

const SIZE = 160;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Draws the arc in once, only for people who have not asked for reduced motion. */
const RING_CSS = `@keyframes bf-ring-draw{from{stroke-dashoffset:${CIRCUMFERENCE.toFixed(2)}}}
@media (prefers-reduced-motion:no-preference){.bf-ring-arc{animation:bf-ring-draw 1.1s cubic-bezier(.22,1,.36,1) .1s both}}`;

export type AccuracyRingProps = {
  /** Accuracy in [0, 1]. */
  value: number;
  /** Small caption under the percentage. */
  caption?: string;
  className?: string;
};

/** A circular meter of accuracy with the percentage in the middle. */
export default function AccuracyRing({
  value,
  caption = "accuracy",
  className,
}: AccuracyRingProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const offset = CIRCUMFERENCE * (1 - clamped);
  return (
    <div className={cn("relative grid size-36 shrink-0 place-items-center sm:size-40", className)}>
      <style>{RING_CSS}</style>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 size-full -rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        {clamped > 0 ? (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="bf-ring-arc stroke-primary"
          />
        ) : null}
      </svg>
      <p className="relative flex flex-col items-center leading-none">
        <span
          className={cn(
            "font-semibold tracking-tight tabular-nums",
            clamped === 1 ? "text-[2rem] sm:text-4xl" : "text-4xl sm:text-[2.75rem]",
          )}
        >
          {formatPercent(clamped)}
        </span>
        <span className="mt-1.5 text-xs text-muted-foreground">{caption}</span>
      </p>
    </div>
  );
}
