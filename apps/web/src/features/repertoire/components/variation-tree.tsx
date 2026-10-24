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
import type { TreeLine, TreeNode } from "../lib/variation-tree";

export type VariationTreeProps = {
  /** The whole repertoire from the start position; keep it referentially stable between edits. */
  tree: TreeLine;
  startPositionId: string;
  /** The start position is the one being shown. */
  atStart: boolean;
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

function NodeRow({
  node,
  alternativeTo,
  actions,
}: {
  node: TreeNode;
  alternativeTo?: string;
  actions: Actions;
}) {
  const { collapsed, onToggle, onSelect, onDelete } = actions;
  const forks = node.alternatives.length > 0;
  const open = isForkOpen(collapsed, node);
  return (
    <div
      className={cn(
        "flex items-center rounded-md",
        node.onPath && "bg-accent/40",
        node.isCurrent && "bg-accent",
      )}
    >
      {forks ? (
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
      ) : (
        <span aria-hidden className="min-w-11 shrink-0" />
      )}
      <button
        type="button"
        aria-label={describeTreeNode(node, { alternativeTo })}
        aria-current={node.isCurrent ? "location" : undefined}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => onSelect(node.positionId, node.route)}
      >
        <span className={cn("font-mono", node.onPath && "font-semibold")}>{node.label}</span>
        <span className="text-xs text-muted-foreground">
          {node.side === "you" ? "you" : "reply"}
        </span>
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
        className="h-11 w-11 shrink-0 px-0"
        aria-label={`Delete ${node.label} and its continuations`}
        onClick={() => onDelete(node.moveId)}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

/**
 * A flat run of moves. A move that has alternatives is followed by them, in a bracket of their
 * own (a left rule, dashed, with an "alternative" tag), before the move that continues the line:
 * an alternative can never be read as the next move of the line above it.
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
      {line.nodes.map((node, index) => (
        <li key={node.moveId}>
          <NodeRow
            node={node}
            alternativeTo={index === 0 ? alternativeTo : undefined}
            actions={actions}
          />
          {node.alternatives.length > 0 && isForkOpen(actions.collapsed, node) ? (
            <ul
              aria-label={`Alternatives to ${node.label}`}
              className="my-1 ml-5 flex flex-col gap-1 border-l-2 border-dashed border-primary/50 pl-2"
            >
              {node.alternatives.map((alternative) => (
                <li key={alternative.nodes[0]?.moveId}>
                  <Line line={alternative} alternativeTo={node.label} actions={actions} />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The repertoire as an outline (presentational): chains of only-children are flat, alternatives at
 * a fork are indented and marked, the line being shown is highlighted, any move can be selected or
 * deleted and the alternatives of a fork can be folded. Transposition leaves point back.
 *
 * It is memoised and takes only the tree, two ids and stable callbacks. The tree depends on the
 * repertoire and the shown line, never on engine data, so engine frames do not re-render it.
 */
function VariationTree({ tree, startPositionId, atStart, onSelect, onDelete }: VariationTreeProps) {
  const [collapsed, setCollapsed] = useState<CollapsedForks>(new Set());
  const actions: Actions = {
    collapsed,
    onToggle: (moveId) => setCollapsed((current) => toggleCollapsed(current, moveId)),
    onSelect,
    onDelete,
  };
  return (
    <nav aria-label="Variation tree" data-slot="variation-tree" className="flex flex-col gap-1">
      <button
        type="button"
        aria-current={atStart ? "location" : undefined}
        className={cn(
          "flex min-h-11 items-center rounded-md px-3 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          atStart && "bg-accent font-semibold",
        )}
        onClick={() => onSelect(startPositionId, [])}
      >
        Start position
      </button>
      {tree.nodes.length === 0 ? (
        <p className="px-3 text-sm text-muted-foreground">
          No moves yet. Play one on the board or type it.
        </p>
      ) : (
        <Line line={tree} actions={actions} />
      )}
    </nav>
  );
}

export default memo(VariationTree);
