import type { TreeLine, TreeNode } from "./variation-tree";

/**
 * One row of the outline in chess notation: a full move (`1. e4 e5`), or a single half-move where
 * the row had to break (`1. e4` before White's alternatives, `1... e5` for Black's reply to it).
 */
export type MoveRow = {
  moveNumber: number;
  white?: TreeNode;
  black?: TreeNode;
  /**
   * The last half-move of the row when it has alternatives. The row ends there so the alternatives
   * can be drawn right below the move they replace.
   */
  fork?: TreeNode;
};

const isWhite = (node: TreeNode) => node.ply % 2 === 1;

/**
 * Groups the plies of a line into rows. A White move opens a row and Black's reply joins it. A row
 * breaks early after a half-move that has alternatives; a Black move that does not follow a White
 * one on the same row (a line or alternative that starts with Black, or a reply after White's fork)
 * opens a row of its own. Pure; the line is not changed.
 */
export function toMoveRows(line: TreeLine): MoveRow[] {
  const rows: MoveRow[] = [];

  for (const node of line.nodes) {
    const moveNumber = Math.ceil(node.ply / 2);
    const last = rows.at(-1);

    if (isWhite(node)) {
      rows.push({ moveNumber, white: node });
    } else if (last?.white && !last.black && !last.fork && last.moveNumber === moveNumber) {
      last.black = node;
    } else {
      rows.push({ moveNumber, black: node });
    }

    if (node.alternatives.length > 0) {
      const row = rows[rows.length - 1];
      if (row) row.fork = node;
    }
  }
  return rows;
}
