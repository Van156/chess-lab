import type { Question } from "./questions";

/** The prompt shown above the answer controls. */
export function describeQuestion(question: Question): string {
  switch (question.kind) {
    case "square_colour":
      return `Is ${question.square} light or dark?`;
    case "coordinates":
      return "Type the name of the highlighted square.";
    case "diagonals": {
      const style = question.direction === "rising" ? "a1-h8" : "a8-h1";
      return `List every square on the ${style} style diagonal through ${question.square}, ${question.square} included.`;
    }
    case "knight_distance":
      return `Fewest knight moves from ${question.from} to ${question.to}?`;
  }
}

/** The right answer as text, for the feedback after a question. */
export function describeExpected(question: Question): string {
  switch (question.kind) {
    case "diagonals":
      return question.expected.join(" ");
    case "knight_distance":
      return String(question.expected);
    default:
      return question.expected;
  }
}

/** Splits typed squares on spaces and commas, dropping empties. */
export function parseSquareList(input: string): string[] {
  return input.split(/[\s,]+/).filter((part) => part !== "");
}
