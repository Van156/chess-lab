import { useEffect } from "react";

import { keyEventIgnored, usesArrows } from "../lib/arrow-controls";
import { bindKeydown, type KeydownHost } from "../lib/key-binding";
import type { RepertoireGraph } from "../lib/repertoire-tree";
import type { RepertoireMove } from "../lib/repertoire-types";
import { treeKeyTarget } from "../lib/tree-keys";

export type TreeKeyOptions = {
  /** False while an engine-line preview is open: the preview owns the arrows then. */
  enabled: boolean;
  graph: RepertoireGraph | undefined;
  path: readonly RepertoireMove[] | null;
  baseLine: readonly RepertoireMove[];
  /** The page's navigation, so the route stays right. */
  onGo: (positionId: string, route: string[]) => void;
  /** Where to look for an open modal; the document by default. */
  root?: Parameters<typeof keyEventIgnored>[1];
};

type TreeKeyEvent = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "target" | "defaultPrevented" | "preventDefault"
>;

/**
 * The keydown handler for the tree: the key's default (scrolling) is only prevented when the board
 * moves, and an event someone already handled, one from an overlay, or any event while a modal is
 * open is left alone.
 */
export function createTreeKeyHandler(options: TreeKeyOptions) {
  const { graph, path, baseLine, onGo, root } = options;
  return (event: TreeKeyEvent) => {
    if (!graph || !path || keyEventIgnored(event, root)) return;
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
}

/** Binds the tree keys to `host` and returns the unbind; nothing is bound while disabled. */
export function bindTreeKeys(options: TreeKeyOptions, host: KeydownHost): (() => void) | undefined {
  if (!options.enabled || !options.graph || !options.path) return undefined;
  return bindKeydown(host, createTreeKeyHandler(options));
}

/**
 * Binds ←, →, Home and End to the tree: they move the board to the parent, the preferred child,
 * the start and the end of the line (the mapping is `treeKeyTarget`'s).
 */
export function useTreeKeyNavigation({ enabled, graph, path, baseLine, onGo }: TreeKeyOptions) {
  useEffect(
    () => bindTreeKeys({ enabled, graph, path, baseLine, onGo }, window),
    [enabled, graph, path, baseLine, onGo],
  );
}
