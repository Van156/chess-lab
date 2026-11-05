import { Button } from "@b2c-template/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { lineColour } from "../lib/line-colours";
import type { PreviewView } from "../lib/line-preview";

export type LinePreviewBarProps = {
  view: PreviewView;
  onPrevious: () => void;
  onNext: () => void;
  /** Leaves the preview and shows the position the line started from. */
  onExit: () => void;
};

/**
 * The banner above the board while an engine line is previewed (presentational): which line, how
 * far along, the step buttons and the way back to the branch start. The step counter is announced
 * as it changes; ← and → work too, and the hint says so for sighted keyboard users.
 */
export default function LinePreviewBar({ view, onPrevious, onNext, onExit }: LinePreviewBarProps) {
  const colour = lineColour(view.rank);
  return (
    <div
      data-slot="line-preview-bar"
      role="group"
      aria-label="Line preview"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-2"
    >
      <p role="status" className="flex min-w-0 flex-1 basis-40 items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          data-slot="line-preview-swatch"
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: colour.color }}
        />
        <span className="font-medium">Previewing line {view.rank + 1}</span>
        <span className="text-muted-foreground">
          move {view.cursor} of {view.total} ({view.san})
        </span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11"
          aria-label="Previous move in the line"
          aria-keyshortcuts="ArrowLeft"
          disabled={!view.canPrevious}
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11"
          aria-label="Next move in the line"
          aria-keyshortcuts="ArrowRight"
          disabled={!view.canNext}
          onClick={onNext}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          aria-keyshortcuts="Escape"
          onClick={onExit}
        >
          Back to branch start
        </Button>
      </div>
      <p className="w-full text-xs text-muted-foreground">
        Use ← and → to step, Esc to go back. Nothing is added to your repertoire.
      </p>
    </div>
  );
}
