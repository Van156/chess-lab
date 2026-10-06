import { describe, expect, test } from "bun:test";

import {
  initialCardTurn,
  nextCardTurnState,
  recordAttempt,
  revealAnswer,
  type CardTurnState,
} from "./card-turn";

const answered: CardTurnState = {
  turnKey: "card-1-0",
  attempt: { san: "e4", correct: true },
  revealed: true,
};

describe("nextCardTurnState", () => {
  test("starts a turn with no attempt and nothing revealed", () => {
    expect(initialCardTurn("card-1-0")).toEqual({
      turnKey: "card-1-0",
      attempt: null,
      revealed: false,
    });
  });

  test("the same turn key keeps the attempt and the reveal (same object)", () => {
    expect(nextCardTurnState(answered, "card-1-0")).toBe(answered);
  });

  test("the next card clears the attempt and the reveal", () => {
    expect(nextCardTurnState(answered, "card-2-1")).toEqual(initialCardTurn("card-2-1"));
  });

  test("the same card shown again after Again (larger done count) clears them too", () => {
    expect(nextCardTurnState(answered, "card-1-1")).toEqual(initialCardTurn("card-1-1"));
  });
});

describe("functional update helpers", () => {
  const fresh = initialCardTurn("card-1-0");

  test("recording an attempt and revealing in the same batch keep both", () => {
    const afterMove = recordAttempt(fresh, "card-1-0", { san: "e4", correct: true });
    const afterReveal = revealAnswer(afterMove, "card-1-0");
    expect(afterReveal).toEqual({
      turnKey: "card-1-0",
      attempt: { san: "e4", correct: true },
      revealed: true,
    });
  });

  test("an event applied to the state of an older turn starts the new turn clean", () => {
    expect(revealAnswer(answered, "card-2-1")).toEqual({
      turnKey: "card-2-1",
      attempt: null,
      revealed: true,
    });
    expect(recordAttempt(answered, "card-2-1", { san: "d4", correct: false }).revealed).toBe(false);
  });
});
