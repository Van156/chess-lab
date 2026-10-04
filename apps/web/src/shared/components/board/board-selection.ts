import type { PromotionPiece } from "./board-types";

/**
 * Pure tap-to-move state machine. The selection is stamped with the `fen` it was made on and
 * `selectionFor` drops it when the position differs, so no reset effect is needed.
 */
export type Selection = {
  fen: string;
  selected: string | null;
  pending: { from: string; to: string } | null;
};

export function emptySelection(fen: string): Selection {
  return { fen, selected: null, pending: null };
}

/** The selection that is valid for `fen`; state made on another position is discarded. */
export function selectionFor(state: Selection, fen: string): Selection {
  return state.fen === fen ? state : emptySelection(fen);
}

export type TapResult = { selection: Selection; attempt?: { from: string; to: string } };

/** One square tap. `attempt` asks the caller to try moving from the selected square. */
export function tap(selection: Selection, square: string, legalUcis: readonly string[]): TapResult {
  if (selection.pending) return { selection };
  const { selected } = selection;
  if (selected && selected !== square) {
    const prefix = `${selected}${square}`;
    if (legalUcis.some((uci) => uci.startsWith(prefix))) {
      return { selection, attempt: { from: selected, to: square } };
    }
  }
  const canMove = legalUcis.some((uci) => uci.startsWith(square));
  return { selection: { ...selection, selected: canMove && square !== selected ? square : null } };
}

export type MoveResolution =
  | { kind: "illegal" }
  | { kind: "promotion" }
  | { kind: "move"; uci: string };

/** Resolves a from/to pair against the legal list, asking for a piece when promotion is needed. */
export function resolveMove(
  legalUcis: readonly string[],
  from: string,
  to: string,
  promotion?: PromotionPiece,
): MoveResolution {
  const candidates = legalUcis.filter((uci) => uci.startsWith(`${from}${to}`));
  if (candidates.length === 0) return { kind: "illegal" };
  if (candidates.every((uci) => uci.length === 5) && !promotion) return { kind: "promotion" };
  return { kind: "move", uci: `${from}${to}${promotion ?? ""}` };
}
