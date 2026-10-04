import type { Grade } from "@b2c-template/study";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { gradeFromKey, matchesAnswer } from "../lib/answer";
import { initialCardTurn, nextCardTurnState } from "../lib/card-turn";
import type { QueueItem } from "../lib/review-types";
import ReviewCardView from "./review-card-view";

/** Keys typed in a field must not grade the card. */
function isTypingTarget(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

/**
 * Stateful wrapper of the card on screen: owns the attempt and reveal state and the focus flow.
 * It stays mounted across cards, so the board only receives new props (ADR-14); `turnKey` (card
 * id plus answers given) resets the state during render and re-runs the focus flow. A fine pointer (desktop, keyboard) lands in the move
 * field; touch lands on the card itself so no keyboard pops up. After the reveal, focus moves to
 * Good and the keys 1 to 4 grade, so a whole session works without the mouse.
 */
export default function ReviewCard({
  card,
  turnKey,
  onGrade,
}: {
  card: QueueItem;
  /** Changes whenever a new card (or the same card shown again) comes on screen. */
  turnKey: string;
  onGrade: (grade: Grade) => void;
}) {
  const [turn, setTurn] = useState(() => initialCardTurn(turnKey));
  const nextTurn = nextCardTurnState(turn, turnKey);
  if (nextTurn !== turn) {
    // Adjusting state during render (not in an effect) avoids a frame of the previous answer.
    setTurn(nextTurn);
  }
  const { attempt, revealed } = nextTurn;
  const rootRef = useRef<HTMLElement>(null);
  const goodRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const input = window.matchMedia("(pointer: fine)").matches ? root.querySelector("input") : null;
    (input ?? root).focus();
  }, [turnKey]);

  useEffect(() => {
    if (revealed) goodRef.current?.focus();
  }, [revealed]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!revealed || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target))
      return;
    const grade = gradeFromKey(event.key);
    if (grade) {
      event.preventDefault();
      onGrade(grade);
    }
  }

  return (
    <div onKeyDown={handleKeyDown}>
      <ReviewCardView
        card={card}
        attempt={attempt}
        revealed={revealed}
        rootRef={rootRef}
        goodRef={goodRef}
        onMove={(move) =>
          setTurn({
            ...nextTurn,
            attempt: { ...move, correct: matchesAnswer(card.answers, move.san) },
          })
        }
        onReveal={() => setTurn({ ...nextTurn, revealed: true })}
        onGrade={onGrade}
      />
    </div>
  );
}
