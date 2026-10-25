import { Badge } from "@b2c-template/ui/components/badge";
import { Button } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";

import { lineColour } from "../lib/line-colours";
import type { EnginePanelState } from "../lib/suggestion-state";

type SuggestionLines = Extract<EnginePanelState, { lines: unknown }>["lines"];

export type EngineLineListProps = {
  lines: SuggestionLines;
  /** An Add is being saved; every Add button waits until it is done. */
  addPending: boolean;
  /** The line being previewed on the board, counted from 0; `null` when none is. */
  previewRank: number | null;
  /** Previews a line, by its rank counted from 0, on the board. */
  onPreview: (rank: number) => void;
  /** Adds the first move of a line, given in SAN, to the repertoire. */
  onAdd: (san: string) => void;
  /** The `data-slot` of the list, so two lists on one page can be told apart. */
  slot?: string;
};

/**
 * The engine lines of a position (presentational), best first. Each line carries its number and the
 * colour of its board arrow, and its score as text. A line previews on the board when clicked; its
 * first move can be added to the repertoire, or is marked when it is already there.
 */
export default function EngineLineList({
  lines,
  addPending,
  previewRank,
  onPreview,
  onAdd,
  slot = "engine-lines",
}: EngineLineListProps) {
  return (
    <ol data-slot={slot} className="flex flex-col gap-2">
      {lines.map((line, rank) => (
        <li
          key={line.multipv}
          className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md border p-2"
        >
          <button
            type="button"
            data-slot="engine-line-preview"
            aria-pressed={previewRank === rank}
            aria-label={`Preview line ${rank + 1}, ${lineColour(rank).name} on the board: ${line.scoreLabel}. ${line.moveText}`}
            onClick={() => onPreview(rank)}
            className={cn(
              "-m-1 flex min-h-11 min-w-0 flex-1 basis-56 flex-wrap items-start gap-x-3 gap-y-1 rounded-md p-1 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
              previewRank === rank && "bg-accent",
            )}
          >
            <span
              data-slot="engine-line-rank"
              className="flex shrink-0 items-center gap-1.5 font-mono text-sm font-semibold"
            >
              <span
                aria-hidden="true"
                data-slot="engine-line-swatch"
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: lineColour(rank).color }}
              />
              {rank + 1}
            </span>
            <span aria-hidden="true" className="w-14 shrink-0 font-mono text-sm font-semibold">
              {line.scoreText}
            </span>
            <span className="min-w-0 flex-1 basis-32 font-mono text-sm break-words">
              {line.moveText}
            </span>
          </button>
          {line.inRepertoire ? (
            <Badge variant="secondary">In repertoire</Badge>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={addPending}
              onClick={() => onAdd(line.firstMove.san)}
            >
              Add {line.firstMove.san}
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}
