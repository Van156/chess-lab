import { Button } from "@b2c-template/ui/components/button";
import { useEffect, useRef } from "react";

import { ChessBoard } from "@/shared/components/board";

import { currentQuestion, type DrillSession } from "../lib/drill-session";
import { formatDuration } from "../lib/format";
import { describeExpected, describeQuestion } from "../lib/question-text";
import type { ExtraQuestion } from "../lib/drills/types";
import { EXTRA_DRILLS, type Answer } from "../lib/questions";
import { ExtraDrillStimulus } from "./answers";
import DrillAnswerInput from "./drill-answer-input";

/** Any legal position works: the board hides its pieces, leaving the highlighted square. */
const EMPTY_BOARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type DrillPlayerProps = {
  /** Drill name shown in the header. */
  label: string;
  session: DrillSession;
  elapsedMs: number;
  onAnswer: (answer: Answer) => void;
  onNext: () => void;
  onQuit: () => void;
};

/** One timed drill question at a time (presentational): prompt, answer controls, then feedback. */
export default function DrillPlayer({
  label,
  session,
  elapsedMs,
  onAnswer,
  onNext,
  onQuit,
}: DrillPlayerProps) {
  const question = currentQuestion(session);
  const total = session.questions.length;
  const result = session.results[session.index];
  const isLast = session.index === total - 1;

  return (
    <section aria-label={`${label} drill`} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{label}</h2>
        <div className="flex items-center gap-4 text-sm tabular-nums">
          <span>
            Question {session.index + 1}/{total}
          </span>
          <span aria-label="Elapsed time">{formatDuration(elapsedMs)}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onQuit}>
            Quit
          </Button>
        </div>
      </header>

      <p className="text-xl font-medium">{describeQuestion(question)}</p>

      {question.kind === "coordinates" ? (
        <div className="w-full max-w-sm">
          <ChessBoard
            fen={EMPTY_BOARD_FEN}
            orientation="white"
            hidden
            coordinates={false}
            highlights={[question.square]}
            label="Empty board with one highlighted square"
          />
        </div>
      ) : null}

      {question.kind in EXTRA_DRILLS ? (
        <ExtraDrillStimulus
          question={question as ExtraQuestion}
          revealed={session.phase === "feedback"}
        />
      ) : null}

      {session.phase === "feedback" && result !== undefined ? (
        <Feedback
          correct={result}
          answer={describeExpected(question)}
          isLast={isLast}
          onNext={onNext}
        />
      ) : (
        <DrillAnswerInput key={session.index} question={question} onSubmit={onAnswer} />
      )}
    </section>
  );
}

function Feedback({
  correct,
  answer,
  isLast,
  onNext,
}: {
  correct: boolean;
  answer: string;
  isLast: boolean;
  onNext: () => void;
}) {
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus(), []);
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="status" className={correct ? "text-green-600" : "text-destructive"}>
        {correct ? "Correct." : "Incorrect."} Answer: <strong>{answer}</strong>
      </p>
      <Button ref={next} type="button" onClick={onNext}>
        {isLast ? "Finish" : "Next"}
      </Button>
    </div>
  );
}
