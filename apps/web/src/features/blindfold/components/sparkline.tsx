import { cn } from "@b2c-template/ui/lib/utils";

import { formatPercent } from "../lib/format";

export type SparklineProps = {
  /** Values in [0, 1], oldest first. */
  values: readonly number[];
  /** Read out instead of the drawing. */
  summary: string;
  width?: number;
  height?: number;
  className?: string;
};

const PAD = 4;

/**
 * A small line of recent accuracy on a fixed 0–100% scale, so drills compare at a glance.
 * The drawing is hidden from assistive tech; `summary` is read instead.
 */
export default function Sparkline({
  values,
  summary,
  width = 104,
  height = 32,
  className,
}: SparklineProps) {
  const points = values.map((value, index) => ({
    x: values.length === 1 ? width - PAD : PAD + (index * (width - PAD * 2)) / (values.length - 1),
    y: PAD + (1 - Math.min(1, Math.max(0, value))) * (height - PAD * 2),
    value,
  }));
  const last = points.at(-1);
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = last
    ? `M${points[0]!.x.toFixed(1)},${height - PAD} L${line.replaceAll(" ", " L")} L${last.x.toFixed(1)},${height - PAD} Z`
    : "";

  return (
    <span className={cn("inline-flex", className)}>
      <svg
        aria-hidden="true"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Recessive guides at 50% and 100%. */}
        <line
          x1={PAD}
          x2={width - PAD}
          y1={PAD}
          y2={PAD}
          strokeDasharray="2 3"
          className="stroke-border"
        />
        <line
          x1={PAD}
          x2={width - PAD}
          y1={height - PAD}
          y2={height - PAD}
          className="stroke-border"
        />
        {points.length > 1 ? (
          <>
            <path d={area} className="fill-primary/10" />
            <polyline
              points={line}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-primary"
            />
          </>
        ) : null}
        {last ? (
          <circle
            cx={last.x}
            cy={last.y}
            r={3.5}
            strokeWidth={2}
            className="fill-primary stroke-card"
          />
        ) : null}
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r={7} className="fill-transparent">
            <title>{formatPercent(point.value)}</title>
          </circle>
        ))}
      </svg>
      <span className="sr-only">{summary}</span>
    </span>
  );
}
