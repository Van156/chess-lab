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
