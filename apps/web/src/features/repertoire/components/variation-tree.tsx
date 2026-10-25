import { Button } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { ChevronDown, ChevronRight, Repeat, Trash2 } from "lucide-react";
import { memo, useState } from "react";

import {
  describeTreeNode,
  isForkOpen,
  isForkPinned,
  toggleCollapsed,
  type CollapsedForks,
} from "../lib/tree-outline";
import { toMoveRows } from "../lib/move-rows";
import type { TreeLine, TreeNode } from "../lib/variation-tree";

export type VariationTreeProps = {
  /**
   * The moves after the base position (the whole repertoire when there is no base); keep it
   * referentially stable between edits.
   */
  tree: TreeLine;
  /**
   * The whole repertoire from the start, offered under a fold when a base hides the moves before
   * it. Null when no base is set. Keep it referentially stable.
   */
  fullTree: TreeLine | null;
  /** Jumps to a move's position by the route that reached it; keep the callback stable. */
  onSelect: (positionId: string, route: string[]) => void;
  /** Asks to delete a move and its continuations; the caller confirms. Keep it stable. */
  onDelete: (moveId: string) => void;
};

type Actions = {
  collapsed: CollapsedForks;
  onToggle: (moveId: string) => void;
  onSelect: VariationTreeProps["onSelect"];
  onDelete: VariationTreeProps["onDelete"];
};

const iconButton =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** One half-move: its select button, the fold toggle when it forks and a delete button. */
function HalfMove({
  node,
  alternativeTo,
  actions,
}: {
  node: TreeNode;
  alternativeTo?: string;
  actions: Actions;
}) {
  const { collapsed, onToggle, onSelect, onDelete } = actions;
  const open = isForkOpen(collapsed, node);
  return (
    <div
      className={cn(
        "flex min-w-0 items-center rounded-md",
        node.onPath && "bg-accent/40",
        node.isCurrent && "bg-accent",
      )}
    >
      {node.alternatives.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} alternatives to ${node.label}`}
          disabled={isForkPinned(node)}
          className={cn(iconButton, "disabled:opacity-40")}
          onClick={() => onToggle(node.moveId)}
        >
          {open ? (
            <ChevronDown aria-hidden className="size-4" />
          ) : (
            <ChevronRight aria-hidden className="size-4" />
          )}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={describeTreeNode(node, { alternativeTo })}
        aria-current={node.isCurrent ? "location" : undefined}
        className="flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-1.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => onSelect(node.positionId, node.route)}
      >
        <span className={cn("font-mono", node.onPath && "font-semibold")}>{node.san}</span>
        {alternativeTo ? (
          <span className="rounded-sm bg-primary/10 px-1.5 text-xs font-medium text-primary">
            alternative
          </span>
        ) : null}
        {node.transposition ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Repeat aria-hidden className="size-3" />
            transposition
          </span>
        ) : null}
      </button>
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-11 shrink-0 px-0 text-muted-foreground"
        aria-label={`Delete ${node.label} and its continuations`}
        onClick={() => onDelete(node.moveId)}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

/**
 * A line as full-move rows (`1. e4 e5`). A row that forks is followed by its alternatives, in a
 * bracket of their own (a left rule, dashed, with an "alternative" tag), before the row that
 * continues the line: an alternative can never be read as the next move of the line above it.
 */
function Line({
  line,
  alternativeTo,
  actions,
}: {
  line: TreeLine;
  alternativeTo?: string;
  actions: Actions;
}) {
  return (
    <ol>
      {toMoveRows(line).map((row, index) => {
        const { white, black, fork } = row;
        const key = (white ?? black)?.moveId;
        // Only the first half-move of an alternative is marked as the alternative.
        const markFirst = index === 0 ? alternativeTo : undefined;
        return (
          <li key={key}>
            <div className="flex flex-wrap items-center gap-x-1">
              <span aria-hidden className="w-9 shrink-0 text-right font-mono text-muted-foreground">
                {row.moveNumber}
                {white ? "." : "..."}
              </span>
              {white ? <HalfMove node={white} alternativeTo={markFirst} actions={actions} /> : null}
              {black ? (
                <HalfMove
                  node={black}
                  alternativeTo={white ? undefined : markFirst}
                  actions={actions}
                />
              ) : null}
            </div>
            {fork && isForkOpen(actions.collapsed, fork) ? (
              <ul
                aria-label={`Alternatives to ${fork.label}`}
                className="my-1 ml-5 flex flex-col gap-1 border-l-2 border-dashed border-primary/50 pl-2"
              >
                {fork.alternatives.map((alternative) => (
                  <li key={alternative.nodes[0]?.moveId}>
                    <Line line={alternative} alternativeTo={fork.label} actions={actions} />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The repertoire as an outline (presentational): lines read as full-move rows, alternatives at
 * a fork are indented and marked, the line being shown is highlighted, any move can be selected or
 * deleted and the alternatives of a fork can be folded. Transposition leaves point back. With a
 * base set the tree starts after it, and the moves from before the base (other openings, other
 * ways in) stay reachable under a fold that shows the whole repertoire from the start.
 *
 * It is memoised and takes only the trees and stable callbacks. The tree depends on the
 * repertoire and the shown line, never on engine data, so engine frames do not re-render it.
 */
function VariationTree({ tree, fullTree, onSelect, onDelete }: VariationTreeProps) {
  const [collapsed, setCollapsed] = useState<CollapsedForks>(new Set());
  const [showAll, setShowAll] = useState(false);
  const actions: Actions = {
    collapsed,
    onToggle: (moveId) => setCollapsed((current) => toggleCollapsed(current, moveId)),
    onSelect,
    onDelete,
  };
  return (
    <nav aria-label="Variation tree" data-slot="variation-tree" className="flex flex-col gap-1">
      {tree.nodes.length === 0 ? (
        <p className="px-3 text-sm text-muted-foreground">
          {fullTree ? "No moves after the base yet." : "No moves yet."} Play one on the board or
          type it.
        </p>
      ) : (
        <Line line={tree} actions={actions} />
      )}
      {fullTree ? (
        <div className="mt-2 flex flex-col gap-1 border-t pt-2">
          <button
            type="button"
            aria-expanded={showAll}
            className="flex min-h-11 items-center gap-1 rounded-md px-3 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? (
              <ChevronDown aria-hidden className="size-4" />
            ) : (
              <ChevronRight aria-hidden className="size-4" />
            )}
            All lines from the start position
          </button>
          {showAll ? <Line line={fullTree} actions={actions} /> : null}
        </div>
      ) : null}
    </nav>
  );
}

export default memo(VariationTree);
