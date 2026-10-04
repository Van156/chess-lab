import { describe, expect, test } from "bun:test";

import { initialCardTurn, nextCardTurnState, type CardTurnState } from "./card-turn";

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
