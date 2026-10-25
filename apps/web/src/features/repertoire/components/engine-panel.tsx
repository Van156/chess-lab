import { Badge } from "@b2c-template/ui/components/badge";
import { Button } from "@b2c-template/ui/components/button";
import { Skeleton } from "@b2c-template/ui/components/skeleton";
import { Switch } from "@b2c-template/ui/components/switch";

import { lineColour } from "../lib/line-colours";
import type { EnginePanelState } from "../lib/suggestion-state";

export type { EnginePanelState };

export type EnginePanelProps = {
  state: EnginePanelState;
  /** An Add is being saved; every Add button waits until it is done. */
  addPending: boolean;
  onToggle: (on: boolean) => void;
  /** Adds the first move of a line, given in SAN, to the repertoire. */
  onAdd: (san: string) => void;
  onRetry: () => void;
};

const OFF_HINT = "Turn on Stockfish to see suggested moves for this position.";

/** Spoken once per search, when it ends; depth updates are never announced. */
function announcement(state: EnginePanelState): string {
  if (state.kind === "done") return `Analysis finished at depth ${state.depth}.`;
  if (state.kind === "unavailable") return "The engine is unavailable.";
  return "";
}

/**
 * Stockfish suggestions for the current position (presentational): an on/off switch, the search
 * depth and the engine lines (one to five, as chosen on the board toolbar). Each line carries its
 * number and the colour of its board arrow, and its score as text. A line's first move can be
 * added to the repertoire, or is marked when it is already there. The builder works whatever state this shows.
 */
export default function EnginePanel({
  state,
  addPending,
  onToggle,
  onAdd,
  onRetry,
}: EnginePanelProps) {
  const search = state.kind === "analysing" || state.kind === "done" ? state : null;
  return (
    <section
      data-slot="engine-panel"
      aria-labelledby="engine-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="engine-heading" className="text-xl font-semibold">
          Engine
        </h2>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={state.kind !== "off"} onCheckedChange={onToggle} />
          Stockfish
        </label>
      </div>
      <p role="status" className="sr-only">
        {announcement(state)}
      </p>
      {state.kind === "off" ? (
        <p data-slot="engine-off" className="text-sm text-muted-foreground">
          {OFF_HINT}
        </p>
      ) : null}
      {state.kind === "starting" ? (
        <div data-slot="engine-starting" className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Starting the engine…</p>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : null}
      {state.kind === "unavailable" ? (
        <div data-slot="engine-unavailable" className="flex flex-wrap items-center gap-2 text-sm">
          <p>The engine is unavailable right now. You can keep building without it.</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
      {state.kind === "terminal" ? (
        <p data-slot="engine-terminal" className="text-sm">
          No legal moves in this position
        </p>
      ) : null}
      {search ? (
        <>
          <p data-slot="engine-depth" className="text-sm text-muted-foreground">
            Depth {search.depth}/{search.maxDepth}
          </p>
          {search.lines.length === 0 ? (
            search.kind === "done" ? (
              <p data-slot="engine-empty" className="text-sm">
                The engine has no suggestion for this position.
              </p>
            ) : (
              <Skeleton className="h-6 w-full" />
            )
          ) : (
            <ol data-slot="engine-lines" className="flex flex-col gap-2">
              {search.lines.map((line, rank) => (
                <li
                  key={line.multipv}
                  className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md border p-2"
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
                    <span aria-hidden="true">{rank + 1}</span>
                    <span className="sr-only">
                      Line {rank + 1}, {lineColour(rank).name} on the board
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-14 shrink-0 font-mono text-sm font-semibold"
                  >
                    {line.scoreText}
                  </span>
                  <span className="sr-only">{line.scoreLabel}</span>
                  <span className="min-w-0 flex-1 basis-40 font-mono text-sm break-words">
                    {line.moveText}
                  </span>
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
          )}
        </>
      ) : null}
    </section>
  );
}
