import type { TreeLine, TreeNode } from "./variation-tree";

/** One study line: the moves that follow a single first move after the base position. */
export type StudyLine = {
  /** The move that leaves the base position (or the start position) and gives the line its name. */
  firstMove: TreeNode;
  /** The stored name of the line, null when it has none. */
  name: string | null;
  /** The line's moves; forks deeper in it stay alternatives, its sibling lines are not among them. */
  line: TreeLine;
  /** The line being shown runs through this one. */
  isCurrent: boolean;
};

const toStudyLine = (line: TreeLine): StudyLine | null => {
  const firstMove = line.nodes[0];
  return firstMove ? { firstMove, name: firstMove.name, line, isCurrent: firstMove.onPath } : null;
};

/**
 * The root fork of a tree as study lines. The tree's main line and the alternatives to its first
 * move each become a line of their own, in the order the server stored them, so the first move is
 * never nested as an "alternative". Pure; the tree is not changed.
 */
export function studyLines(tree: TreeLine): StudyLine[] {
  const [first, ...rest] = tree.nodes;
  if (!first) return [];

  const main: TreeLine = { ...tree, nodes: [{ ...first, alternatives: [] }, ...rest] };
  return [main, ...first.alternatives].flatMap((line) => toStudyLine(line) ?? []);
}

/**
 * What to do with the text typed for a line name: nothing when it equals the stored name once
 * trimmed, otherwise the trimmed name to save, where blank text clears the name.
 */
export function lineNameEdit(
  draft: string,
  current: string | null,
): { save: false } | { save: true; name: string | null } {
  const name = draft.trim() === "" ? null : draft.trim();
  return name === current ? { save: false } : { save: true, name };
}
