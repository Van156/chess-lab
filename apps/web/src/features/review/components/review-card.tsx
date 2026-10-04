import type { Grade } from "@b2c-template/study";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { gradeFromKey, matchesAnswer } from "../lib/answer";
import type { QueueItem } from "../lib/review-types";
import ReviewCardView, { type Attempt } from "./review-card-view";

/** Keys typed in a field must not grade the card. */
function isTypingTarget(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

/**
 * Stateful wrapper of one card: owns the attempt and reveal state and the focus flow, so the
 * session screen can key it by card id. A fine pointer (desktop, keyboard) lands in the move
 * field; touch lands on the card itself so no keyboard pops up. After the reveal, focus moves to
 * Good and the keys 1 to 4 grade, so a whole session works without the mouse.
 */
export default function ReviewCard({
  card,
  onGrade,
}: {
  card: QueueItem;
  onGrade: (grade: Grade) => void;
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [revealed, setRevealed] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const goodRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const input = window.matchMedia("(pointer: fine)").matches ? root.querySelector("input") : null;
    (input ?? root).focus();
  }, []);

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
        onMove={(move) => setAttempt({ ...move, correct: matchesAnswer(card.answers, move.san) })}
        onReveal={() => setRevealed(true)}
        onGrade={onGrade}
      />
    </div>
  );
}
