import type { DrillSession } from "./drill-session";
import { describeExpected, describeQuestion } from "./question-text";
import type { Answer, Question } from "./questions";

/** One answered question, ready for the results review list. */
export type ReviewItem = { prompt: string; expected: string; given: string; correct: boolean };

const PIECE_NAMES: Record<string, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

/** "yes"/"no" read as "Yes"/"No"; other text is left alone. */
function capitaliseYesNo(text: string): string {
  return text === "yes" ? "Yes" : text === "no" ? "No" : text;
}

/** A given answer as text, in the same terms the feedback uses. */
export function formatAnswer(question: Question, answer: Answer | undefined): string {
  if (answer === undefined) return "No answer";
  if (typeof answer === "number") return String(answer);
  if (typeof answer !== "string") {
    return answer.length === 0 ? "No answer" : answer.join(" ");
  }
  const text = answer.trim();
  if (text === "") return "No answer";
  if (question.kind === "position_recall") {
    if (text.toLowerCase() === "empty") return "Empty";
    const code = /^([wb])([KQRBNP])$/i.exec(text);
    if (code) {
      const colour = code[1]!.toLowerCase() === "w" ? "White" : "Black";
      return `${colour} ${PIECE_NAMES[code[2]!.toUpperCase()]}`;
    }
  }
  return capitaliseYesNo(text);
}

/**
 * Every answered question of a session, in order, with its prompt, the right answer and the
 * answer given. Sessions without recorded answers (`answers` missing) show "No answer".
 */
export function buildReview(
  session: Pick<DrillSession, "questions" | "results"> & { answers?: readonly Answer[] },
): ReviewItem[] {
  return session.results.flatMap((correct, index) => {
    const question = session.questions[index];
    if (!question) return [];
    return [
      {
        prompt: describeQuestion(question),
        expected: capitaliseYesNo(describeExpected(question)),
        given: formatAnswer(question, session.answers?.[index]),
        correct,
      },
    ];
  });
}
