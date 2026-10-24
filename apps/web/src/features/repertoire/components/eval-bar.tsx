import { cn } from "@b2c-template/ui/lib/utils";

export type EvalBarProps = {
  /** White's share of the bar, 0 to 100. `null` (no score yet) draws a neutral 50%. */
  whitePercent: number | null;
  /** The board's orientation: White's share grows from the bottom for white, from the top for black. */
  orientation: "white" | "black";
  className?: string;
};

const NEUTRAL_PERCENT = 50;

/** Keeps the share inside the bar; a non-finite value (a bad score) draws the neutral 50%. */
const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : NEUTRAL_PERCENT;

/**
 * Engine evaluation bar (presentational). Decorative: the score is also in the engine panel as
 * text, so the bar is hidden from assistive technology. It has a fixed width and fills the height
 * of its container, so a changing score never moves the layout.
 */
export default function EvalBar({ whitePercent, orientation, className }: EvalBarProps) {
  const percent = clampPercent(whitePercent ?? NEUTRAL_PERCENT);
  return (
    <div
      aria-hidden="true"
      data-slot="eval-bar"
      className={cn(
        "relative h-full w-4 shrink-0 overflow-hidden rounded-sm border border-border bg-neutral-800",
        className,
      )}
    >
      <div
        data-slot="eval-bar-white"
        className={cn(
          "absolute inset-x-0 bg-white transition-[height] duration-300 motion-reduce:transition-none",
          orientation === "white" ? "bottom-0" : "top-0",
        )}
        style={{ height: `${percent}%` }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-500" />
    </div>
  );
}
