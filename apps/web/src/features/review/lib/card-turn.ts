import type { Attempt } from "../components/review-card-view";

/** What the card on screen remembers about the current turn. */
export type CardTurnState = {
  /** Card id plus answers given: changes for a new card and for the same card after Again. */
  turnKey: string;
  attempt: Attempt | null;
  revealed: boolean;
};

export function initialCardTurn(turnKey: string): CardTurnState {
  return { turnKey, attempt: null, revealed: false };
}

/** Pure render-time reset: a new turn starts clean; the same turn keeps its state untouched. */
export function nextCardTurnState(prev: CardTurnState, turnKey: string): CardTurnState {
  return prev.turnKey === turnKey ? prev : initialCardTurn(turnKey);
}

/**
 * Functional-update helpers: each reads the latest state (never a render-time snapshot) and applies
 * the turn reset first, so two events batched before a re-render both land.
 */
export function recordAttempt(
  prev: CardTurnState,
  turnKey: string,
  attempt: Attempt,
): CardTurnState {
  return { ...nextCardTurnState(prev, turnKey), attempt };
}

export function revealAnswer(prev: CardTurnState, turnKey: string): CardTurnState {
  return { ...nextCardTurnState(prev, turnKey), revealed: true };
}
