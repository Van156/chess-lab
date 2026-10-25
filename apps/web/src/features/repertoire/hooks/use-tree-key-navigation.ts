import { useEffect } from "react";

import { usesArrows } from "../lib/arrow-controls";
import type { RepertoireGraph } from "../lib/repertoire-tree";
import type { RepertoireMove } from "../lib/repertoire-types";
import { treeKeyTarget } from "../lib/tree-keys";

/**
 * Binds ←, →, Home and End to the tree: they move the board to the parent, the preferred child,
 * the start and the end of the line (the mapping is `treeKeyTarget`'s). `enabled` is false while
 * an engine-line preview is open, because the preview owns the arrows then. `onGo` is the page's
 * navigation, so the route stays right. The key's default (scrolling) is only prevented when the
 * board moves.
 */
export function useTreeKeyNavigation({
  enabled,
  graph,
  path,
  baseLine,
  onGo,
}: {
  enabled: boolean;
  graph: RepertoireGraph | undefined;
  path: readonly RepertoireMove[] | null;
  baseLine: readonly RepertoireMove[];
  onGo: (positionId: string, route: string[]) => void;
}): void {
  useEffect(() => {
    if (!enabled || !graph || !path) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = treeKeyTarget(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          targetUsesArrows: usesArrows(event.target),
        },
        { graph, path, baseLine },
      );
      if (!target) return;
      event.preventDefault();
      onGo(target.positionId, target.route);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, graph, path, baseLine, onGo]);
}
