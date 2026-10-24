import { Button } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { Trash2 } from "lucide-react";

import { describeChildMove } from "../lib/builder-state";
import type { RepertoireMove } from "../lib/repertoire-types";

export type LineNavigatorProps = {
  /** Moves from the start position to the current position. */
  path: readonly RepertoireMove[];
  /** Moves already in the repertoire from the current position. */
  childMoves: readonly RepertoireMove[];
  /** Go back to the position after the first `ply` moves of the path (0 is the start). */
  onSelectPly: (ply: number) => void;
  onSelectChild: (move: RepertoireMove) => void;
  /** Asks to delete a move; the caller confirms, since the continuations go with it. */
  onDelete: (move: RepertoireMove) => void;
};

const stepClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** Where you are in the tree: breadcrumbs back to the start, the moves that continue from here, delete. */
export default function LineNavigator({
  path,
  childMoves,
  onSelectPly,
  onSelectChild,
  onDelete,
}: LineNavigatorProps) {
  const incoming = path[path.length - 1];
  return (
    <div data-slot="line-navigator" className="flex flex-col gap-4">
      <nav aria-label="Path to this position">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <button
              type="button"
              className={cn(stepClass, path.length === 0 && "bg-accent font-semibold")}
              aria-current={path.length === 0 ? "location" : undefined}
              onClick={() => onSelectPly(0)}
            >
              Start
            </button>
          </li>
          {path.map((move, index) => {
            const current = index === path.length - 1;
            return (
              <li key={move.id}>
                <button
                  type="button"
                  className={cn(stepClass, current && "bg-accent font-semibold")}
                  aria-current={current ? "location" : undefined}
                  onClick={() => onSelectPly(index + 1)}
                >
                  {describeChildMove(index, move.san)}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="next-moves-heading" className="flex flex-col gap-2">
        <h3 id="next-moves-heading" className="text-sm font-medium">
          Next moves
        </h3>
        {childMoves.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No moves from here yet. Play one on the board or type it.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {childMoves.map((move) => {
              const label = describeChildMove(path.length, move.san);
              return (
                <li key={move.id} className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 justify-start gap-3 px-4"
                    onClick={() => onSelectChild(move)}
                  >
                    <span className="font-mono">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {move.isUserMove ? "Your move" : "Opponent reply"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-11 shrink-0 px-0"
                    aria-label={`Delete ${label} and its continuations`}
                    onClick={() => onDelete(move)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {incoming ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 self-start px-4"
          onClick={() => onDelete(incoming)}
        >
          <Trash2 data-icon="inline-start" />
          Delete this move
        </Button>
      ) : null}
    </div>
  );
}
