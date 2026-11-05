import type { Grade } from "@b2c-template/study";

import type { QueueItem } from "./review-types";

type Answers = QueueItem["answers"];

/** SAN without check, mate and annotation marks, so `Qxf7` equals `Qxf7+`. */
function normalizeSan(san: string): string {
  return san.replace(/[+#!?]+$/, "");
}

/** True when the move played is one of the accepted answers. */
export function matchesAnswer(answers: Answers, san: string): boolean {
  const played = normalizeSan(san);
  return answers.some((answer) => normalizeSan(answer.san) === played);
}

/** Arrow for the first accepted answer; empty when the card has none. */
export function answerArrow(answers: Answers): { from: string; to: string }[] {
  const uci = answers[0]?.uci;
  return uci ? [{ from: uci.slice(0, 2), to: uci.slice(2, 4) }] : [];
}

export function answerHighlights(answers: Answers): string[] {
  return answerArrow(answers).flatMap((arrow) => [arrow.from, arrow.to]);
}

const GRADE_KEYS: Record<string, Grade> = { "1": 1, "2": 2, "3": 3, "4": 4 };

/** Keyboard shortcut for a grade button (1 Again, 2 Hard, 3 Good, 4 Easy). */
export function gradeFromKey(key: string): Grade | null {
  return GRADE_KEYS[key] ?? null;
}
