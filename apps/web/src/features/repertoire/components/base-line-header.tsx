import { Button } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { memo } from "react";

import { baseHeading, canSetBase } from "../lib/base-line";
import type { RepertoireMove } from "../lib/repertoire-types";

export type BaseLineHeaderProps = {
  /** The moves from the start to the base; empty when no base is set. Keep it referentially stable. */
  baseLine: readonly RepertoireMove[];
  startPositionId: string;
  /** The base position; null when none is set. */
  basePositionId: string | null;
  /** The position being shown. */
  currentPositionId: string;
  /** A base change is being saved. */
  saving: boolean;
  /** Jumps to a position by its route; keep the callback stable. */
  onSelect: (positionId: string, route: string[]) => void;
  onSetBase: () => void;
  onClearBase: () => void;
};

const heading =
  "flex min-h-11 w-full items-center rounded-md px-3 py-2 text-left text-sm break-words outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * The top of the variation tree (presentational): the base line in move-pair notation, or "Start
 * position" when there is none, as a button that goes there, plus the actions that set the base to
 * the position being shown or clear it. The text wraps rather than scrolls, so it fits a narrow
 * screen however long the base is.
 */
function BaseLineHeader({
  baseLine,
  startPositionId,
  basePositionId,
  currentPositionId,
  saving,
  onSelect,
  onSetBase,
  onClearBase,
}: BaseLineHeaderProps) {
  const hasBase = baseLine.length > 0 && basePositionId !== null;
  const targetId = hasBase ? basePositionId : startPositionId;
  const current = currentPositionId === targetId;
  return (
    <div data-slot="base-line-header" className="flex flex-col gap-1">
      <button
        type="button"
        aria-current={current ? "location" : undefined}
        className={cn(heading, current && "bg-accent font-semibold")}
        onClick={() =>
          onSelect(
            targetId,
            baseLine.map((move) => move.id),
          )
        }
      >
        {baseHeading(baseLine)}
      </button>
      <div className="flex flex-wrap gap-2">
        {canSetBase(currentPositionId, startPositionId, hasBase ? basePositionId : null) ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 px-4"
            disabled={saving}
            aria-label="Set this position as the base line"
            onClick={onSetBase}
          >
            Set as base
          </Button>
        ) : null}
        {hasBase ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-4"
            disabled={saving}
            aria-label="Clear the base line"
            onClick={onClearBase}
          >
            Clear base
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default memo(BaseLineHeader);
