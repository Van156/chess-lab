import { Button } from "@b2c-template/ui/components/button";
import { Skeleton } from "@b2c-template/ui/components/skeleton";
import { Switch } from "@b2c-template/ui/components/switch";

import type { EnginePanelState } from "../lib/suggestion-state";
import EngineLineList from "./engine-line-list";

export type EngineNextMovesProps = {
  state: EnginePanelState;
  /** An Add is being saved; every Add button waits until it is done. */
  addPending: boolean;
  /** The line being previewed on the board, counted from 0; `null` when none is. */
  previewRank: number | null;
  onToggle: (on: boolean) => void;
  /** Previews a line, by its rank counted from 0, on the board. */
  onPreview: (rank: number) => void;
  /** Adds the first move of a line, given in SAN, to the repertoire. */
  onAdd: (san: string) => void;
  onRetry: () => void;
};

/** Spoken once per search, when it ends; depth updates are never announced. */
function announcement(state: EnginePanelState): string {
  if (state.kind === "done") return `Analysis finished at depth ${state.depth}.`;
  if (state.kind === "unavailable") return "The engine is unavailable.";
  return "";
}

/**
 * The engine for the current position (presentational), shown under the tree so the next move can
 * be chosen without leaving it. It is the only engine control: the Stockfish switch, the search
 * depth, the lines (one to five, as chosen on the board toolbar; each can be previewed on the
 * board and its first move added), the starting skeleton, Retry when the engine is unavailable and
 * the terminal message. The builder works whatever state this shows.
 */
export default function EngineNextMoves({
  state,
  addPending,
  previewRank,
  onToggle,
  onPreview,
  onAdd,
  onRetry,
}: EngineNextMovesProps) {
  const search = state.kind === "analysing" || state.kind === "done" ? state : null;
  return (
    <section
      data-slot="engine-next-moves"
      aria-labelledby="engine-next-moves-heading"
      className="mt-3 flex flex-col gap-2 border-t pt-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id="engine-next-moves-heading" className="text-sm font-semibold">
          Engine · next move
        </h3>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <Switch checked={state.kind !== "off"} onCheckedChange={onToggle} />
          Stockfish
        </label>
      </div>
      <p role="status" className="sr-only">
        {announcement(state)}
      </p>
      {search ? (
        <p data-slot="engine-next-depth" className="text-xs text-muted-foreground">
          Depth {search.depth}/{search.maxDepth}
        </p>
      ) : null}
      {state.kind === "off" ? (
        <p data-slot="engine-next-off" className="text-sm text-muted-foreground">
          Turn on Stockfish to see suggested moves for this position.
        </p>
      ) : null}
      {state.kind === "starting" ? (
        <div data-slot="engine-next-starting" className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Starting the engine…</p>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : null}
      {state.kind === "unavailable" ? (
        <div
          data-slot="engine-next-unavailable"
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <p>The engine is unavailable right now. You can keep building without it.</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
      {state.kind === "terminal" ? (
        <p data-slot="engine-next-terminal" className="text-sm">
          No legal moves in this position
        </p>
      ) : null}
      {search && search.lines.length === 0 ? (
        search.kind === "done" ? (
          <p data-slot="engine-next-empty" className="text-sm">
            The engine has no suggestion for this position.
          </p>
        ) : (
          <Skeleton className="h-6 w-full" />
        )
      ) : null}
      {search && search.lines.length > 0 ? (
        <EngineLineList
          slot="engine-next-lines"
          lines={search.lines}
          addPending={addPending}
          previewRank={previewRank}
          onPreview={onPreview}
          onAdd={onAdd}
        />
      ) : null}
    </section>
  );
}
