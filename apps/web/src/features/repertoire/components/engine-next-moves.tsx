import { Skeleton } from "@b2c-template/ui/components/skeleton";

import type { EnginePanelState } from "../lib/suggestion-state";
import EngineLineList from "./engine-line-list";

export type EngineNextMovesProps = {
  state: EnginePanelState;
  /** An Add is being saved; every Add button waits until it is done. */
  addPending: boolean;
  /** The line being previewed on the board, counted from 0; `null` when none is. */
  previewRank: number | null;
  onPreview: (rank: number) => void;
  onAdd: (san: string) => void;
};

/**
 * The engine's lines for the current position, compact, for the Tree tab (presentational), so the
 * next move can be chosen without leaving the tree. The Engine tab owns the on/off switch, the
 * retry and the announcements; here those states are a hint or nothing.
 */
export default function EngineNextMoves({
  state,
  addPending,
  previewRank,
  onPreview,
  onAdd,
}: EngineNextMovesProps) {
  const search = state.kind === "analysing" || state.kind === "done" ? state : null;
  if (state.kind === "terminal" || state.kind === "unavailable") return null;
  return (
    <section
      data-slot="engine-next-moves"
      aria-labelledby="engine-next-moves-heading"
      className="mt-3 flex flex-col gap-2 border-t pt-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id="engine-next-moves-heading" className="text-sm font-semibold">
          Engine · next move
        </h3>
        {search ? (
          <p data-slot="engine-next-depth" className="text-xs text-muted-foreground">
            Depth {search.depth}/{search.maxDepth}
          </p>
        ) : null}
      </div>
      {state.kind === "off" ? (
        <p data-slot="engine-next-off" className="text-sm text-muted-foreground">
          Turn on Stockfish in the Engine tab to see suggested moves here.
        </p>
      ) : null}
      {state.kind === "starting" ? (
        <div data-slot="engine-next-starting" className="flex flex-col gap-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
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
