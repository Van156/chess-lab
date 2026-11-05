import { cn } from "@b2c-template/ui/lib/utils";
import type { ReactNode } from "react";

import { fenFromPieces } from "../../lib/drills/fen";
import type {
  CheckDetectionQuestion,
  ExtraQuestion,
  MateInOneQuestion,
  PieceColour,
  PlacedPiece,
  PositionRecallQuestion,
  SameDiagonalQuestion,
} from "../../lib/drills/types";
import type { Answer } from "../../lib/questions";
import { squareColour } from "../../lib/squares";
import { START_FEN, diagonalName, diagonalPath, locateMove, replayMoves } from "./board-helpers";
import MoveAnswer from "./move-answer";
import MoveSequence from "./move-sequence";
import PieceList from "./piece-list";
import PiecePicker from "./piece-picker";
import { PIECE_NAMES, describePieceCode } from "./pieces";
import RevealBoard from "./reveal-board";
import SquareChip from "./square-chip";
import YesNoAnswer from "./yes-no-answer";

/** Arrow colour for checks: a warm red, apart from the mint used for moves. */
const CHECK_ARROW = "#f87171";

export type ExtraAnswerProps = { question: ExtraQuestion; onSubmit: (answer: Answer) => void };

/** Answer controls for the drills implemented in `lib/drills/*`. */
export function ExtraDrillAnswer({ question, onSubmit }: ExtraAnswerProps) {
  switch (question.kind) {
    case "same_diagonal":
      return <YesNoAnswer label="Same diagonal" onSubmit={onSubmit} />;
    case "check_detection":
      return <YesNoAnswer label="King in check" onSubmit={onSubmit} />;
    case "position_recall":
      return <PiecePicker onSubmit={onSubmit} />;
    case "mate_in_one":
      return <MoveAnswer onSubmit={onSubmit} />;
  }
}

export type ExtraStimulusProps = {
  question: ExtraQuestion;
  /** True once the question is answered: the stimulus may reveal the solution. */
  revealed: boolean;
};

/**
 * What the player reads before answering (square names, piece list, move list), and once
 * answered, a small board that shows the solution. Nothing about the position is drawn before.
 */
export function ExtraDrillStimulus({ question, revealed }: ExtraStimulusProps) {
  switch (question.kind) {
    case "same_diagonal":
      return <SameDiagonalStimulus question={question} revealed={revealed} />;
    case "check_detection":
      return <CheckDetectionStimulus question={question} revealed={revealed} />;
    case "position_recall":
      return <PositionRecallStimulus question={question} revealed={revealed} />;
    case "mate_in_one":
      return <MateInOneStimulus question={question} revealed={revealed} />;
  }
}

/** Text stimulus, with the reveal board beside it on wide screens and below it on narrow ones. */
function StimulusLayout({ children, reveal }: { children: ReactNode; reveal: ReactNode }) {
  return (
    <div
      data-slot="drill-stimulus"
      className={cn(
        "flex flex-col gap-4",
        reveal ? "sm:flex-row sm:items-start sm:gap-6" : undefined,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {reveal ? <div className="sm:w-64 sm:shrink-0 lg:w-72">{reveal}</div> : null}
    </div>
  );
}

function SameDiagonalStimulus({
  question,
  revealed,
}: {
  question: SameDiagonalQuestion;
  revealed: boolean;
}) {
  const path = diagonalPath(question.a, question.b);
  return (
    <StimulusLayout reveal={revealed ? <SameDiagonalReveal question={question} /> : null}>
      <div className="flex items-center gap-3 sm:gap-4">
        <SquareChip square={question.a} />
        <span
          aria-hidden
          className="w-6 border-t-2 border-dotted border-muted-foreground/50 sm:w-10"
        />
        <span className="sr-only">and</span>
        <SquareChip square={question.b} />
      </div>
      {revealed && path ? (
        <p className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0">
          <span className="sr-only">The diagonal runs through</span>
          {path.map((square, index) => (
            <span key={square} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span aria-hidden className="text-muted-foreground/60">
                  ·
                </span>
              ) : null}
              <span className="font-mono text-foreground">{square}</span>
            </span>
          ))}
        </p>
      ) : null}
    </StimulusLayout>
  );
}

function SameDiagonalReveal({ question }: { question: SameDiagonalQuestion }) {
  const { a, b } = question;
  const path = diagonalPath(a, b);
  const colourA = squareColour(a);
  const colourB = squareColour(b);
  let caption: ReactNode;
  if (path) {
    caption = (
      <>
        <Mono>{a}</Mono> and <Mono>{b}</Mono> share the <Mono>{diagonalName(path)}</Mono> diagonal.
      </>
    );
  } else if (colourA !== colourB) {
    caption = (
      <>
        <Mono>{a}</Mono> is {colourA} and <Mono>{b}</Mono> is {colourB}. A diagonal never changes
        colour.
      </>
    );
  } else {
    caption = (
      <>
        Both are {colourA} squares, but no single diagonal runs through <Mono>{a}</Mono> and{" "}
        <Mono>{b}</Mono>.
      </>
    );
  }
  return (
    <RevealBoard
      fen={START_FEN}
      showPieces={false}
      highlights={[a, b]}
      arrows={path ? [{ from: a, to: b }] : []}
      label={path ? `Diagonal from ${a} to ${b}` : `Squares ${a} and ${b}`}
      caption={caption}
    />
  );
}

function CheckDetectionStimulus({
  question,
  revealed,
}: {
  question: CheckDetectionQuestion;
  revealed: boolean;
}) {
  return (
    <StimulusLayout reveal={revealed ? <CheckDetectionReveal question={question} /> : null}>
      <PieceList pieces={question.pieces} />
    </StimulusLayout>
  );
}

function kingSquare(pieces: readonly PlacedPiece[], colour: PieceColour): string | undefined {
  return pieces.find((piece) => piece.piece === "K" && piece.colour === colour)?.square;
}

function CheckDetectionReveal({ question }: { question: CheckDetectionQuestion }) {
  const king = kingSquare(question.pieces, question.king);
  const checkers = question.checkers.map((square) =>
    question.pieces.find((piece) => piece.square === square),
  );
  const named = checkers
    .filter((piece): piece is PlacedPiece => piece !== undefined)
    .map((piece) => (
      <span key={piece.square}>
        the {PIECE_NAMES[piece.piece]} on <Mono>{piece.square}</Mono>
      </span>
    ));
  const caption =
    named.length > 0 ? (
      <>Check from {joinNodes(named)}.</>
    ) : (
      <>
        No piece attacks the {question.king} king
        {king ? (
          <>
            {" "}
            on <Mono>{king}</Mono>
          </>
        ) : null}
        .
      </>
    );
  return (
    <RevealBoard
      fen={fenFromPieces(question.pieces, question.king)}
      highlights={king ? [king] : []}
      arrows={
        king
          ? question.checkers.map((square) => ({ from: square, to: king, color: CHECK_ARROW }))
          : []
      }
      label={`The position, ${question.king} king highlighted`}
      caption={caption}
    />
  );
}

function PositionRecallStimulus({
  question,
  revealed,
}: {
  question: PositionRecallQuestion;
  revealed: boolean;
}) {
  return (
    <StimulusLayout reveal={revealed ? <PositionRecallReveal question={question} /> : null}>
      <MoveSequence moves={question.moves} />
    </StimulusLayout>
  );
}

function PositionRecallReveal({ question }: { question: PositionRecallQuestion }) {
  const { fen } = replayMoves(question.moves);
  const caption =
    question.expected === "empty" ? (
      <>
        <Mono>{question.square}</Mono> is empty.
      </>
    ) : (
      <>
        On <Mono>{question.square}</Mono>: {describePieceCode(question.expected).toLowerCase()}.
      </>
    );
  return (
    <RevealBoard
      fen={fen}
      highlights={[question.square]}
      label={`Position after the moves, ${question.square} highlighted`}
      caption={caption}
    />
  );
}

function MateInOneStimulus({
  question,
  revealed,
}: {
  question: MateInOneQuestion;
  revealed: boolean;
}) {
  return (
    <StimulusLayout reveal={revealed ? <MateInOneReveal question={question} /> : null}>
      <div className="flex flex-col gap-3">
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          {question.toMove === "white" ? "White" : "Black"} to move
        </p>
        <PieceList pieces={question.pieces} toMove={question.toMove} />
      </div>
    </StimulusLayout>
  );
}

function MateInOneReveal({ question }: { question: MateInOneQuestion }) {
  const arrows = question.expected
    .map((san) => locateMove(question.fen, san))
    .filter((move) => move !== null)
    .map((move) => ({ from: move.from, to: move.to }));
  const moves = question.expected.map((san) => <Mono key={san}>{san}#</Mono>);
  const defender = kingSquare(question.pieces, question.toMove === "white" ? "black" : "white");
  return (
    <RevealBoard
      fen={question.fen}
      arrows={arrows}
      highlights={defender ? [defender] : []}
      label="The position with the mating move"
      caption={
        moves.length === 1 ? (
          <>{moves} is mate.</>
        ) : (
          <>
            {joinNodes(moves)} {moves.length === 2 ? "both" : "all"} give mate.
          </>
        )
      }
    />
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-foreground">{children}</span>;
}

/** "a", "a and b", "a, b and c". */
function joinNodes(nodes: readonly ReactNode[]): ReactNode {
  return nodes.map((node, index) => (
    <span key={index}>
      {index === 0 ? "" : index === nodes.length - 1 ? " and " : ", "}
      {node}
    </span>
  ));
}
