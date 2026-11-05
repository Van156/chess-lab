import { Button } from "@b2c-template/ui/components/button";
import { Kbd } from "@b2c-template/ui/components/kbd";
import { cn } from "@b2c-template/ui/lib/utils";
import { Check, Flame, Timer, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { currentQuestion, streak, type DrillSession } from "../lib/drill-session";
import type { ExtraQuestion } from "../lib/drills/types";
import { formatDuration } from "../lib/format";
import { describeExpected, describeQuestion, parseSquareList } from "../lib/question-text";
import type { Answer, DrillKind, Question } from "../lib/questions";
import { ExtraDrillStimulus } from "./answers";
import DrillAnswerInput, { DRILL_PROMPT_ID, isTypingTarget } from "./drill-answer-input";
import DrillBoard from "./drill-board";
import { isOriginalQuestion, RevealBoard, RevealExplanation } from "./drill-reveal";
import { SquareChip, SquareText, type ChipTone } from "./square-chip";

/** Speed drills move on by themselves after a right answer; the rest wait for Next. */
const AUTO_ADVANCE_KINDS: ReadonlySet<DrillKind> = new Set(["square_colour", "same_diagonal"]);
const DEFAULT_AUTO_ADVANCE_MS = 700;
/** From this many answers, Quit asks first: there is real progress to lose. */
const CONFIRM_QUIT_FROM = 3;
/** A streak shows from this many right answers in a row. */
const STREAK_FROM = 3;

export type DrillPlayerProps = {
  /** Drill name shown in the header. */
  label: string;
  session: DrillSession;
  elapsedMs: number;
  onAnswer: (answer: Answer) => void;
  onNext: () => void;
  onQuit: () => void;
  /**
   * Delay before a right answer in a speed drill (square colour, same diagonal) moves on by
   * itself. Defaults to 700ms; null always waits for Next.
   */
  autoAdvanceMs?: number | null;
};

/** True for the keys that move past feedback: Enter and Space. */
export function isNextKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

/** Whether a right answer to this kind moves on without Next. */
export function autoAdvances(kind: DrillKind, correct: boolean, delayMs: number | null): boolean {
  return correct && delayMs !== null && AUTO_ADVANCE_KINDS.has(kind);
}

export type PipState = "correct" | "wrong" | "current" | "upcoming";

/** One state per question, for the progress track. */
export function pipStates(session: DrillSession): PipState[] {
  return session.questions.map((_, index) => {
    const result = session.results[index];
    if (result !== undefined) return result ? "correct" : "wrong";
    return index === session.index ? "current" : "upcoming";
  });
}

/** One timed drill question at a time (presentational): prompt, answer controls, then feedback. */
export default function DrillPlayer({
  label,
  session,
  elapsedMs,
  onAnswer,
  onNext,
  onQuit,
  autoAdvanceMs = DEFAULT_AUTO_ADVANCE_MS,
}: DrillPlayerProps) {
  const question = currentQuestion(session);
  const total = session.questions.length;
  const result = session.results[session.index];
  const isLast = session.index === total - 1;
  const feedback = session.phase === "feedback" && result !== undefined;
  const stage = useRef<HTMLDivElement>(null);
  const prompt = useRef<HTMLParagraphElement>(null);

  // A new question: keep focus in the stage. Text inputs focus themselves; otherwise the prompt
  // takes focus, so a screen reader reads it and the old Next button does not strand focus.
  useEffect(() => {
    if (session.phase !== "asking") return;
    const active = document.activeElement;
    if (active && active !== document.body && stage.current?.contains(active)) return;
    prompt.current?.focus({ preventScroll: true });
  }, [session.index, session.phase]);

  return (
    <section
      aria-label={`${label} drill`}
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-5"
    >
      <TopBar
        label={label}
        session={session}
        elapsedMs={elapsedMs}
        onQuit={onQuit}
        current={session.index + 1}
        total={total}
      />

      <div
        ref={stage}
        className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card px-4 py-7 text-center sm:gap-8 sm:px-10 sm:py-10"
      >
        <p
          ref={prompt}
          id={DRILL_PROMPT_ID}
          tabIndex={-1}
          className={cn(
            "max-w-xl text-2xl leading-snug font-semibold tracking-tight text-balance outline-none sm:text-[1.75rem]",
            describeQuestion(question).length > 60 && "text-xl sm:text-2xl",
          )}
        >
          <SquareText text={describeQuestion(question)} />
        </p>

        {/* Always mounted, so screen readers announce each result as it arrives. */}
        <p role="status" aria-live="polite" className="sr-only">
          {feedback
            ? announcement(question, result, autoAdvances(question.kind, result, autoAdvanceMs))
            : ""}
        </p>

        <Stimulus question={question} session={session} revealed={feedback} />

        {feedback ? (
          <Feedback
            key={session.index}
            question={question}
            answer={session.lastAnswer}
            correct={result}
            isLast={isLast}
            autoAdvance={autoAdvances(question.kind, result, autoAdvanceMs)}
            autoAdvanceMs={autoAdvanceMs ?? 0}
            onNext={onNext}
          />
        ) : (
          <DrillAnswerInput key={session.index} question={question} onSubmit={onAnswer} />
        )}
      </div>
    </section>
  );
}

function TopBar({
  label,
  session,
  elapsedMs,
  current,
  total,
  onQuit,
}: {
  label: string;
  session: DrillSession;
  elapsedMs: number;
  current: number;
  total: number;
  onQuit: () => void;
}) {
  const run = streak(session);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const answered = session.results.length;
  const correct = session.results.filter(Boolean).length;
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
          <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">{label}</h2>
          <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">
            Level {session.level}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {run >= STREAK_FROM ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-sm font-medium text-warning tabular-nums",
                confirmingQuit && "max-sm:hidden",
              )}
              aria-label={`${run} right in a row`}
            >
              <Flame aria-hidden="true" className="size-3.5" />
              {run}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-1 font-mono text-sm text-muted-foreground tabular-nums",
              confirmingQuit && "max-sm:hidden",
            )}
          >
            <Timer aria-hidden="true" className="size-3.5" />
            <span aria-label="Elapsed time" className="text-foreground">
              {formatDuration(elapsedMs)}
            </span>
          </span>
          <QuitControl
            answered={answered}
            confirming={confirmingQuit}
            onConfirmingChange={setConfirmingQuit}
            onQuit={onQuit}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Drill progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          aria-valuetext={`Question ${current} of ${total}, ${correct} right so far`}
          className="flex flex-1 gap-[3px] sm:gap-1"
        >
          {pipStates(session).map((state, index) => (
            <span
              key={index}
              data-pip={state}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                state === "correct" && "bg-primary",
                state === "wrong" && "bg-destructive",
                state === "current" &&
                  "bg-primary/25 ring-1 ring-primary ring-inset motion-safe:animate-pulse",
                state === "upcoming" && "bg-muted",
              )}
            />
          ))}
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          <span className="max-sm:sr-only">Question </span>
          {current}/{total}
        </span>
      </div>
    </header>
  );
}

/** Quit, which asks first once a few questions are answered (Escape keeps going). */
function QuitControl({
  answered,
  confirming,
  onConfirmingChange: setConfirming,
  onQuit,
}: {
  answered: number;
  confirming: boolean;
  onConfirmingChange: (confirming: boolean) => void;
  onQuit: () => void;
}) {
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!confirming) return;
    stay.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirming(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming, setConfirming]);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => (answered >= CONFIRM_QUIT_FROM ? setConfirming(true) : onQuit())}
      >
        Quit
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Quit the drill?" className="flex items-center gap-1">
      <span className="hidden text-sm text-muted-foreground sm:inline">Lose this run?</span>
      <Button
        ref={stay}
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
      >
        Keep going
      </Button>
      <Button type="button" variant="destructive" size="sm" onClick={onQuit}>
        Quit
      </Button>
    </div>
  );
}

/** What the player looks at: nothing for the pure blindfold drills, a board for coordinates. */
function Stimulus({
  question,
  session,
  revealed,
}: {
  question: Question;
  session: DrillSession;
  revealed: boolean;
}) {
  if (!isOriginalQuestion(question)) {
    return <ExtraDrillStimulus question={question as ExtraQuestion} revealed={revealed} />;
  }
  if (revealed) {
    return (
      <RevealBoard
        question={question}
        answer={session.lastAnswer}
        className={
          question.kind === "coordinates" ? "max-w-[420px]" : "max-w-[280px] sm:max-w-[320px]"
        }
      />
    );
  }
  if (question.kind !== "coordinates") return null;
  return (
    <DrillBoard
      className="max-w-[420px]"
      label="Empty board with one highlighted square"
      marks={{ [question.square]: "target" }}
      coordinates={false}
    />
  );
}

/** What the live region says after an answer. */
function announcement(question: Question, correct: boolean, autoAdvance: boolean): string {
  if (correct) return autoAdvance ? "Correct. Next question coming up." : "Correct.";
  return `Incorrect. The answer is ${describeExpected(question)}.`;
}

/** The answer given, as text for the feedback ("You said …"). */
function answerText(answer: Answer | null): string {
  if (answer === null) return "";
  if (typeof answer === "number") return String(answer);
  if (typeof answer === "string") return answer.trim();
  return answer.join(" ");
}

/** A square, a SAN move or a count: what the feedback sets as a mono chip. */
const NOTATION = /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?[+#]?|\d+)$/;

/** Squares, moves and counts as mono chips; words such as "light" or "yes" as plain text. */
function Chips({
  text,
  tone,
  toneFor,
}: {
  text: string;
  tone?: ChipTone;
  /** Per-chip tone, for lists where some squares are right and some are not. */
  toneFor?: (part: string) => ChipTone;
}) {
  const parts = parseSquareList(text);
  if (parts.length === 0 || !parts.every((part) => NOTATION.test(part))) {
    // Prose ("light", "Yes, Bd2 gives check"): plain text, with any squares in it as chips.
    return (
      <strong
        className={cn(
          "font-semibold",
          tone === "destructive" && "text-destructive line-through decoration-1",
          tone === "success" && "text-primary",
        )}
      >
        <SquareText text={text} />
      </strong>
    );
  }
  return (
    <span className="inline-flex flex-wrap justify-center gap-1 align-middle">
      {parts.map((part, index) => (
        <SquareChip key={`${part}-${index}`} tone={toneFor ? toneFor(part) : tone}>
          {part}
        </SquareChip>
      ))}
    </span>
  );
}

function Feedback({
  question,
  answer,
  correct,
  isLast,
  autoAdvance,
  autoAdvanceMs,
  onNext,
}: {
  question: Question;
  answer: Answer | null;
  correct: boolean;
  isLast: boolean;
  autoAdvance: boolean;
  autoAdvanceMs: number;
  onNext: () => void;
}) {
  const next = useRef<HTMLButtonElement>(null);
  const [draining, setDraining] = useState(false);

  useEffect(() => next.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isNextKey(event.key) || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // A focused button or field handles Enter and Space itself.
      if (isTypingTarget(event)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("button, a, [role=button]")) return;
      event.preventDefault();
      onNext();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onNext]);

  // The latest `onNext`, so a parent re-render (the clock ticks every second) does not restart
  // the auto-advance timer.
  const latestNext = useRef(onNext);
  useEffect(() => {
    latestNext.current = onNext;
  });
  useEffect(() => {
    if (!autoAdvance) return;
    const frame = requestAnimationFrame(() => setDraining(true));
    const timer = setTimeout(() => latestNext.current(), autoAdvanceMs);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [autoAdvance, autoAdvanceMs]);

  const expected = describeExpected(question);
  const given = answerText(answer);
  const explanation: ReactNode = isOriginalQuestion(question) ? (
    <RevealExplanation question={question} />
  ) : null;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <div
        className={cn(
          "relative flex w-full items-start gap-3 overflow-hidden rounded-xl border px-4 py-3 text-left motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
          correct ? "border-primary/30 bg-primary/10" : "border-destructive/30 bg-destructive/10",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
            correct ? "bg-primary text-primary-foreground" : "bg-destructive text-white",
          )}
        >
          {correct ? (
            <Check className="size-4" strokeWidth={3} />
          ) : (
            <X className="size-4" strokeWidth={3} />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className={cn("font-semibold", correct ? "text-primary" : "text-destructive")}>
            {correct ? "Correct." : "Incorrect."}
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <span className="text-muted-foreground">Answer:</span>
            <Chips text={expected} tone={correct ? "success" : "neutral"} />
          </p>
          {!correct && given !== "" ? (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
              <span className="text-muted-foreground">You said:</span>
              <Chips
                text={given}
                tone="destructive"
                {...(question.kind === "diagonals"
                  ? {
                      toneFor: (square: string) =>
                        question.expected.includes(square.toLowerCase())
                          ? "success"
                          : "destructive",
                    }
                  : {})}
              />
            </p>
          ) : null}
        </div>
        {autoAdvance ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary/70 ease-linear motion-safe:transition-transform"
            style={{
              transform: draining ? "scaleX(0)" : "scaleX(1)",
              transitionDuration: `${autoAdvanceMs}ms`,
            }}
          />
        ) : null}
      </div>

      {explanation ? (
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{explanation}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          ref={next}
          type="button"
          className="h-11 min-w-32 rounded-xl px-6 text-base"
          onClick={onNext}
        >
          {isLast ? "Finish" : "Next"}
        </Button>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
          <Kbd>Enter</Kbd> or <Kbd>Space</Kbd>
        </span>
      </div>
    </div>
  );
}
