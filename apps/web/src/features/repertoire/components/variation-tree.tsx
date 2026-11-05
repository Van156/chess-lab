import { Button } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { ChevronDown, ChevronRight, Repeat, Trash2 } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { sortByRank, type EngineBest, type MoveRank } from "../lib/continuation-ranking";
import {
  describeTreeNode,
  isForkOpen,
  isForkPinned,
  toggleCollapsed,
  type CollapsedForks,
} from "../lib/tree-outline";
import { toMoveRows } from "../lib/move-rows";
import { studyLines } from "../lib/study-lines";
import { clearPath, type TreeLine, type TreeNode } from "../lib/variation-tree";
import StudyLineName from "./study-line-name";

export type VariationTreeProps = {
  /**
   * The moves after the base position (the whole repertoire when there is no base); keep it
   * referentially stable between edits.
   */
  tree: TreeLine;
  /**
   * The whole repertoire from the start, offered under a fold when a base hides the moves before
   * it. Null when no base is set. Keep it referentially stable. The fold only lists moves: the
   * shown line is not marked there, so the current move is announced once, in `tree`.
   */
  fullTree: TreeLine | null;
  /** Jumps to a move's position by the route that reached it; keep the callback stable. */
  onSelect: (positionId: string, route: string[]) => void;
  /** Asks to delete a move and its continuations; the caller confirms. Keep it stable. */
  onDelete: (moveId: string) => void;
  /** Names the study line that starts with a move; null clears the name. Keep it stable. */
  onRename: (moveId: string, name: string | null) => void;
  /**
   * The engine's grades of the continuations it has analysed, by move id. Graded study lines and
   * alternatives are listed best first and each graded move carries a badge, even when it is the
   * only stored move; where the engine prefers a move the repertoire lacks, a graded position also
   * names it (`MoveRank.engineBest`). Ungraded moves keep their stored order. Pass only settled results and keep it referentially stable between them,
   * so engine frames do not re-render the tree. The full-repertoire fold stays unranked.
   */
  rankings?: ReadonlyMap<string, MoveRank>;
  /** Starts with the full-repertoire fold open (it is closed otherwise). */
  foldOpenByDefault?: boolean;
};

const NO_RANKINGS: ReadonlyMap<string, MoveRank> = new Map();

type Actions = {
  collapsed: CollapsedForks;
  rankings: ReadonlyMap<string, MoveRank>;
  onToggle: (moveId: string) => void;
  onSelect: VariationTreeProps["onSelect"];
  onDelete: VariationTreeProps["onDelete"];
};

const iconButton =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** The engine's better move at a position, in words so that no colour carries the meaning. */
function EngineBestText({ best }: { best: EngineBest }) {
  return (
    <>
      Engine best: <span className="font-mono">{best.san}</span>{" "}
      <span className="font-mono tabular-nums">{best.scoreLabel}</span>
    </>
  );
}

/**
 * One half-move: its select button, the fold toggle when it forks and a delete button. When the
 * engine grades the position it continues and the repertoire lacks the engine's best move, `hint`
 * adds that move to the button and to its label.
 */
function HalfMove({
  node,
  alternativeTo,
  hint,
  actions,
}: {
  node: TreeNode;
  alternativeTo?: string;
  hint: boolean;
  actions: Actions;
}) {
  const { collapsed, rankings, onToggle, onSelect, onDelete } = actions;
  const open = isForkOpen(collapsed, node);
  const rank = rankings.get(node.moveId);
  const engineBest = hint ? rank?.engineBest : undefined;
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
        aria-label={describeTreeNode(node, { alternativeTo, rank, engineBest })}
        aria-current={node.isCurrent ? "location" : undefined}
        className="flex min-h-11 min-w-11 flex-wrap items-center gap-x-1.5 rounded-md px-1.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => onSelect(node.positionId, node.route)}
      >
        <span className={cn("font-mono", node.onPath && "font-semibold")}>{node.san}</span>
        {rank ? (
          <span className="rounded-sm bg-muted px-1.5 font-mono text-xs tabular-nums text-muted-foreground">
            #{rank.rank} {rank.scoreLabel}
          </span>
        ) : null}
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
        {engineBest ? (
          <span className="w-full text-xs text-muted-foreground">
            <EngineBestText best={engineBest} />
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
 *
 * The engine's better move is shown once per position, on the move that continues the line. The
 * first move of an alternative is its sibling, so it never repeats the hint, and `hintFirst` is
 * off where the caller shows the first position's hint itself.
 */
function Line({
  line,
  alternativeTo,
  hintFirst = true,
  actions,
}: {
  line: TreeLine;
  alternativeTo?: string;
  hintFirst?: boolean;
  actions: Actions;
}) {
  return (
    <ol>
      {toMoveRows(line).map((row, index) => {
        const { white, black, fork } = row;
        const key = (white ?? black)?.moveId;
        // Only the first half-move of an alternative is marked as the alternative.
        const markFirst = index === 0 ? alternativeTo : undefined;
        const hintWhite = index > 0 || (hintFirst && !alternativeTo);
        return (
          <li key={key}>
            <div className="flex flex-wrap items-center gap-x-1">
              <span aria-hidden className="w-9 shrink-0 text-right font-mono text-muted-foreground">
                {row.moveNumber}
                {white ? "." : "..."}
              </span>
              {white ? (
                <HalfMove
                  node={white}
                  alternativeTo={markFirst}
                  hint={hintWhite}
                  actions={actions}
                />
              ) : null}
              {black ? (
                <HalfMove
                  node={black}
                  alternativeTo={white ? undefined : markFirst}
                  hint={white ? true : hintWhite}
                  actions={actions}
                />
              ) : null}
            </div>
            {fork && isForkOpen(actions.collapsed, fork) ? (
              <ul
                aria-label={`Alternatives to ${fork.label}`}
                className="my-1 ml-5 flex flex-col gap-1 border-l-2 border-dashed border-primary/50 pl-2"
              >
                {sortByRank(
                  fork.alternatives,
                  (alternative) => actions.rankings.get(alternative.nodes[0]?.moveId ?? "")?.rank,
                ).map((alternative) => (
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
 * The whole repertoire from the start under a disclosure. It is a plain outline: the shown line is
 * not marked in it (that would announce the current move twice) and its alternatives fold on their
 * own state, apart from the study lines above.
 */
function FullTreeFold({
  fullTree,
  defaultOpen,
  onSelect,
  onDelete,
}: Pick<VariationTreeProps, "onSelect" | "onDelete"> & {
  fullTree: TreeLine;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [collapsed, setCollapsed] = useState<CollapsedForks>(new Set());
  const plain = useMemo(() => clearPath(fullTree), [fullTree]);
  const actions: Actions = {
    collapsed,
    rankings: NO_RANKINGS,
    onToggle: (moveId) => setCollapsed((current) => toggleCollapsed(current, moveId)),
    onSelect,
    onDelete,
  };
  return (
    <div className="mt-2 flex flex-col gap-1 border-t pt-2">
      <button
        type="button"
        aria-expanded={open}
        className="flex min-h-11 items-center gap-1 rounded-md px-3 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? (
          <ChevronDown aria-hidden className="size-4" />
        ) : (
          <ChevronRight aria-hidden className="size-4" />
        )}
        All lines from the start position
      </button>
      {open ? (
        <div role="group" aria-label="All lines from the start position">
          <Line line={plain} actions={actions} />
        </div>
      ) : null}
    </div>
  );
}

/** The study lines of a tree: each first move after the base is a group with a name to edit. */
function StudyLines({
  tree,
  actions,
  onRename,
}: {
  tree: TreeLine;
  actions: Actions;
  onRename: VariationTreeProps["onRename"];
}) {
  const { rankings } = actions;
  const lines = useMemo(
    () => sortByRank(studyLines(tree), (line) => rankings.get(line.firstMove.moveId)?.rank),
    [tree, rankings],
  );
  // Every study line starts at the same position, so one hint serves them all.
  const engineBest = lines
    .map((studyLine) => rankings.get(studyLine.firstMove.moveId)?.engineBest)
    .find((best) => best !== undefined);
  return (
    <>
      {engineBest ? (
        <p className="px-3 text-sm text-muted-foreground">
          <EngineBestText best={engineBest} />
        </p>
      ) : null}
      <ul aria-label="Study lines" className="flex flex-col gap-2">
        {lines.map(({ firstMove, name, line, isCurrent }) => (
          <li
            key={firstMove.moveId}
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-2",
              isCurrent && "border-primary bg-accent/20",
            )}
          >
            <div className="flex items-center gap-1">
              <StudyLineName
                name={name}
                firstMoveLabel={firstMove.label}
                onRename={(next) => onRename(firstMove.moveId, next)}
              />
              {isCurrent ? <span className="sr-only">Current line</span> : null}
            </div>
            <Line line={line} hintFirst={false} actions={actions} />
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The repertoire as an outline (presentational): the moves after the base are grouped into study
 * lines, one per first move, each with its name and an inline rename; inside a line the moves read
 * as full-move rows, alternatives at a deeper fork are indented and marked, the line being shown
 * is highlighted, any move can be selected or deleted and the alternatives of a fork can be
 * folded. Transposition leaves point back. With a base set the tree starts after it, and the moves
 * from before the base (other openings, other ways in) stay reachable under a fold that lists the
 * whole repertoire from the start: a plain outline with its own folds, without the current-line
 * marks, so no move is announced as the current location twice.
 *
 * Where the engine has graded the continuations of a position, its study lines and alternatives are
 * listed best first, each move shows a `#rank score` badge (the score is from the mover's side) and
 * says the same in its label; the move that continues a line keeps its place and still shows its
 * badge. A position whose best engine move is not stored also shows "Engine best: Bc4 +0.40", once:
 * above the study lines for the first position, otherwise on the move that continues the line.
 *
 * It is memoised and takes only the trees, the settled rankings and stable callbacks. The tree
 * depends on the repertoire and the shown line, and the rankings change once per finished search,
 * never on an engine frame, so engine frames do not re-render it.
 */
function VariationTree({
  tree,
  fullTree,
  onSelect,
  onDelete,
  onRename,
  rankings = NO_RANKINGS,
  foldOpenByDefault = false,
}: VariationTreeProps) {
  const [collapsed, setCollapsed] = useState<CollapsedForks>(new Set());
  const actions: Actions = {
    collapsed,
    rankings,
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
        <StudyLines tree={tree} actions={actions} onRename={onRename} />
      )}
      {fullTree ? (
        <FullTreeFold
          fullTree={fullTree}
          defaultOpen={foldOpenByDefault}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ) : null}
    </nav>
  );
}

export default memo(VariationTree);
