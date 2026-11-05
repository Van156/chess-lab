import type { ReactNode } from "react";

import type { Answer, Question } from "../lib/questions";
import { fileAndRank, knightPath, type Square } from "../lib/squares";
import DrillBoard, { type SquareMark } from "./drill-board";
import { SquareChip } from "./square-chip";

type OriginalQuestion = Extract<
  Question,
  { kind: "square_colour" | "coordinates" | "diagonals" | "knight_distance" }
>;

const ORIGINAL_KINDS: ReadonlySet<Question["kind"]> = new Set([
  "square_colour",
  "coordinates",
  "diagonals",
  "knight_distance",
]);

export function isOriginalQuestion(question: Question): question is OriginalQuestion {
  return ORIGINAL_KINDS.has(question.kind);
}

/** Typed squares, normalised the way grading reads them. */
function answeredSquares(answer: Answer | null): string[] {
  if (answer === null || typeof answer === "number") return [];
  const list = typeof answer === "string" ? [answer] : answer;
  return list.map((square) => square.trim().toLowerCase()).filter((square) => square !== "");
}

/** The board for the learning reveal after an answer: what the square, line or route looks like. */
export function RevealBoard({
  question,
  answer,
  className,
}: {
  question: OriginalQuestion;
  answer: Answer | null;
  className?: string;
}) {
  switch (question.kind) {
    case "square_colour":
      return (
        <DrillBoard
          className={className}
          label={`Board with ${question.square} highlighted, a ${question.expected} square`}
          marks={{ [question.square]: "target" }}
        />
      );
    case "coordinates":
      return (
        <DrillBoard
          className={className}
          label={`Board with ${question.square} highlighted and named`}
          marks={{ [question.square]: "target" }}
          labels={{ [question.square]: question.square }}
        />
      );
    case "diagonals": {
      const named = new Set(answeredSquares(answer));
      const marks: Partial<Record<Square, SquareMark>> = {};
      for (const square of question.expected) {
        marks[square] = answer === null || named.has(square) ? "expected" : "missed";
      }
      const wrong = [...named].filter(
        (square) => /^[a-h][1-8]$/.test(square) && !question.expected.includes(square),
      );
      for (const square of wrong) marks[square] = "wrong";
      marks[question.square] = "target";
      return (
        <DrillBoard
          className={className}
          label={`Board with the diagonal ${question.expected.join(" ")} highlighted${
            wrong.length ? `; squares named in error: ${wrong.join(" ")}` : ""
          }`}
          marks={marks}
        />
      );
    }
    case "knight_distance": {
      const path = knightPath(question.from, question.to);
      const hops = path.slice(1).map((square, index) => [path[index] ?? square, square] as const);
      const labels: Partial<Record<Square, string>> = {};
      path.slice(1, -1).forEach((square, index) => {
        labels[square] = String(index + 1);
      });
      return (
        <DrillBoard
          className={className}
          label={`Board with a shortest knight route: ${path.join(" to ")}`}
          marks={{ [question.from]: "target", [question.to]: "expected" }}
          labels={labels}
          knightHops={hops}
        />
      );
    }
  }
}

/** One or two sentences that explain the right answer, with squares as chips. */
export function RevealExplanation({ question }: { question: OriginalQuestion }): ReactNode {
  switch (question.kind) {
    case "square_colour": {
      const { file, fileNumber, rank } = fileAndRank(question.square);
      const sum = fileNumber + rank;
      return (
        <>
          <SquareChip>{file}</SquareChip> is file {fileNumber}. {fileNumber} + {rank} = {sum}, an{" "}
          {sum % 2 === 0 ? "even" : "odd"} sum, so <SquareChip>{question.square}</SquareChip> is{" "}
          {question.expected}. Even sums are dark, like <SquareChip>a1</SquareChip>.
        </>
      );
    }
    case "coordinates": {
      const { file, rank } = fileAndRank(question.square);
      return (
        <>
          File <SquareChip>{file}</SquareChip>, rank <SquareChip>{String(rank)}</SquareChip>. Files
          run a to h from White&rsquo;s left; ranks count up from White&rsquo;s side.
        </>
      );
    }
    case "diagonals":
      return (
        <>
          {question.expected.length} squares from{" "}
          <SquareChip>{question.expected[0] ?? ""}</SquareChip> to{" "}
          <SquareChip>{question.expected.at(-1) ?? ""}</SquareChip>, through{" "}
          <SquareChip>{question.square}</SquareChip>.
        </>
      );
    case "knight_distance": {
      const path = knightPath(question.from, question.to);
      return (
        <>
          One shortest route:{" "}
          {path.map((square, index) => (
            <span key={square}>
              {index > 0 ? <span aria-hidden="true"> → </span> : null}
              {index > 0 ? <span className="sr-only">to</span> : null}
              <SquareChip>{square}</SquareChip>
            </span>
          ))}
        </>
      );
    }
  }
}
