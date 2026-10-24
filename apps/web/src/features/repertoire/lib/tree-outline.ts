import type { TreeNode } from "./variation-tree";

/** The move ids whose alternatives are folded away in the outline. */
export type CollapsedForks = ReadonlySet<string>;

/** `collapsed` with `moveId` folded if it was open, opened if it was folded; the input is untouched. */
export function toggleCollapsed(collapsed: CollapsedForks, moveId: string): Set<string> {
  const next = new Set(collapsed);
  if (!next.delete(moveId)) next.add(moveId);
  return next;
}

/** The line being shown runs through one of the move's alternatives, so they cannot be folded. */
export function isForkPinned(node: TreeNode): boolean {
  return node.alternatives.some((line) => line.nodes[0]?.onPath);
}

/**
 * Whether the alternatives of a move are shown. A pinned fork stays open, so the current move is
 * never hidden inside a folded branch.
 */
export function isForkOpen(collapsed: CollapsedForks, node: TreeNode): boolean {
  return !collapsed.has(node.moveId) || isForkPinned(node);
}

/**
 * The accessible name of a move in the outline. Colour and indentation never carry the meaning
 * alone: an alternative says what it is an alternative to, and a transposition says it points back.
 */
export function describeTreeNode(node: TreeNode, options: { alternativeTo?: string } = {}): string {
  return [
    node.label,
    node.side === "you" ? "your move" : "opponent reply",
    options.alternativeTo ? `alternative to ${options.alternativeTo}` : "",
    node.transposition ? "transposition to a position shown above" : "",
  ]
    .filter(Boolean)
    .join(", ");
}
