import { Switch } from "@b2c-template/ui/components/switch";
import { cn } from "@b2c-template/ui/lib/utils";
import { useId } from "react";

import { LINE_COUNT_MAX, LINE_COUNT_MIN } from "../lib/lines-preference";

export type BoardToolbarProps = {
  /** How many engine lines the board draws, 1 to 5. */
  lineCount: number;
  onChangeLineCount: (count: number) => void;
  /** The repertoire's own moves are drawn on the board. */
  showRepertoireArrows: boolean;
  onToggleRepertoireArrows: (on: boolean) => void;
};

const COUNTS = Array.from(
  { length: LINE_COUNT_MAX - LINE_COUNT_MIN + 1 },
  (_, index) => LINE_COUNT_MIN + index,
);

/**
 * What the board draws (presentational): a 1 to 5 choice for the engine lines and a switch for
 * the repertoire's own moves. The count is a group of real toggle buttons, each named in words.
 */
export default function BoardToolbar({
  lineCount,
  onChangeLineCount,
  showRepertoireArrows,
  onToggleRepertoireArrows,
}: BoardToolbarProps) {
  const labelId = useId();
  return (
    <div
      data-slot="board-toolbar"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
    >
      <div className="flex items-center gap-2">
        <span id={labelId} className="text-sm font-medium">
          Lines
        </span>
        <div role="group" aria-labelledby={labelId} className="inline-flex rounded-lg border p-0.5">
          {COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={count === lineCount}
              aria-label={`${count} ${count === 1 ? "line" : "lines"} on the board`}
              className={cn(
                "min-h-11 min-w-11 rounded-md text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                count === lineCount && "bg-primary text-primary-foreground hover:bg-primary",
              )}
              onClick={() => onChangeLineCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <Switch checked={showRepertoireArrows} onCheckedChange={onToggleRepertoireArrows} />
        Repertoire arrows
      </label>
    </div>
  );
}
