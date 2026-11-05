import { CARD_STATE, type Grade } from "@b2c-template/study";
import { Button } from "@b2c-template/ui/components/button";
import { Card } from "@b2c-template/ui/components/card";
import { cn } from "@b2c-template/ui/lib/utils";
import type { Ref } from "react";

import { ChessBoard, SanInput, type BoardMove } from "@/shared/components/board";

import { answerArrow, answerHighlights } from "../lib/answer";
import type { QueueItem } from "../lib/review-types";

/** The move the user tried before revealing the answer. */
export type Attempt = { san: string; correct: boolean; from?: string; to?: string };

export const GRADE_OPTIONS: readonly { grade: Grade; label: string; className: string }[] = [
  { grade: 1, label: "Again", className: "border-destructive/60 text-destructive" },
  { grade: 2, label: "Hard", className: "border-orange-400/60 text-orange-300" },
  { grade: 3, label: "Good", className: "border-primary/60 text-primary" },
  { grade: 4, label: "Easy", className: "border-sky-400/60 text-sky-300" },
];

const STATE_LABEL: Record<QueueItem["state"], string> = {
  [CARD_STATE.New]: "New",
  [CARD_STATE.Learning]: "Learning",
  [CARD_STATE.Review]: "Review",
  [CARD_STATE.Relearning]: "Relearning",
};

const SIDE_LABEL = { white: "White", black: "Black" } as const;

/** Pawns lost, one decimal: 120 cp is "1.2". */
function pawns(cp: number): string {
  return (cp / 100).toFixed(1);
}

export type ReviewCardViewProps = {
  card: QueueItem;
  attempt: Attempt | null;
  revealed: boolean;
  onMove: (move: { san: string; from?: string; to?: string }) => void;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
  /** Focus target when the card appears (keyboard and screen reader users start here). */
  rootRef?: Ref<HTMLElement>;
  /** Focus target once the answer is revealed. */
  goodRef?: Ref<HTMLButtonElement>;
};

/**
 * One review card: the board prompt, a move by board or typed SAN, the revealed answer and the
 * four grade buttons. State lives in the container (`ReviewCard`), so every state renders from
 * props. The board's position only changes when the card does (ADR-14).
 */
export default function ReviewCardView({
  card,
  attempt,
  revealed,
  onMove,
  onReveal,
  onGrade,
  rootRef,
  goodRef,
}: ReviewCardViewProps) {
  const side = SIDE_LABEL[card.prompt.orientation];
  const answer = card.answers[0];

  function handleBoardMove(move: BoardMove): boolean {
    onMove({ san: move.san, from: move.from, to: move.to });
    return true;
  }

  return (
    <section
      ref={rootRef}
      tabIndex={-1}
      aria-labelledby="review-card-title"
      className="grid gap-6 outline-none lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
    >
      <Card className="rounded-2xl p-4">
        <ChessBoard
          fen={card.prompt.fen}
          orientation={card.prompt.orientation}
          label={`Chess position. ${side} to move: find the best move.`}
          {...(revealed
            ? { arrows: answerArrow(card.answers), highlights: answerHighlights(card.answers) }
            : {
                onMove: handleBoardMove,
                ...(attempt?.from && attempt.to
                  ? { lastMove: { from: attempt.from, to: attempt.to } }
                  : {}),
              })}
        />
      </Card>

      <Card className="flex flex-col gap-4 rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="review-card-title" className="text-xl font-semibold">
            Find the best move for {side}
          </h2>
          <span className="rounded-full border border-primary px-3 py-1 text-sm font-semibold text-primary">
            {STATE_LABEL[card.state]}
          </span>
        </div>

        {revealed ? (
          <div aria-live="polite" className="rounded-2xl border border-primary p-4">
            <p className="font-mono text-2xl font-bold text-primary">
              {answer?.san ?? "No answer"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {attempt
                ? attempt.correct
                  ? `You played ${attempt.san}: that is the best move.`
                  : `You played ${attempt.san}, not the best move.`
                : "You did not enter a move."}{" "}
              In your game you played {card.context.playedSan} here and lost about{" "}
              {pawns(card.context.evalLossCp)} pawns.
            </p>
          </div>
        ) : (
          <>
            <SanInput fen={card.prompt.fen} onMove={(san) => onMove({ san })} />
            <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
              {attempt ? `Move entered: ${attempt.san}. Show the answer to check it.` : ""}
            </p>
            <Button type="button" size="lg" className="min-h-11 self-start px-6" onClick={onReveal}>
              Show answer
            </Button>
          </>
        )}

        {revealed ? (
          <div
            role="group"
            aria-label="Grade this card"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {GRADE_OPTIONS.map((option) => (
              <Button
                key={option.grade}
                ref={option.grade === 3 ? goodRef : undefined}
                type="button"
                variant="outline"
                aria-keyshortcuts={String(option.grade)}
                className={cn("min-h-11 min-w-11 flex-col gap-0 py-2 font-bold", option.className)}
                onClick={() => onGrade(option.grade)}
              >
                {option.label}
                <span className="text-xs font-medium text-muted-foreground">
                  Key {option.grade}
                </span>
              </Button>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
