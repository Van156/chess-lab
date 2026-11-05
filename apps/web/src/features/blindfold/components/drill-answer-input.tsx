import { Button } from "@b2c-template/ui/components/button";
import { Input } from "@b2c-template/ui/components/input";
import { Kbd } from "@b2c-template/ui/components/kbd";
import { Label } from "@b2c-template/ui/components/label";
import { cn } from "@b2c-template/ui/lib/utils";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { boardTheme } from "@/shared/components/board";

import { parseSquareList } from "../lib/question-text";
import type { Answer, DrillKind, Question } from "../lib/questions";
import { parseSquare } from "../lib/squares";
import { ExtraDrillAnswer } from "./answers";
import { SquareChip } from "./square-chip";

/** Largest knight distance between two squares of the board. */
const MAX_KNIGHT_DISTANCE = 6;
const KNIGHT_ANSWERS = Array.from({ length: MAX_KNIGHT_DISTANCE + 1 }, (_, index) => index);

/** The id of the prompt, so text inputs can point their description at it. */
export const DRILL_PROMPT_ID = "drill-prompt";

export type DrillAnswerInputProps = {
  question: Question;
  onSubmit: (answer: Answer) => void;
};

/**
 * The answer a single key gives for a drill with button answers: L and D for square colour, the
 * digits 0-6 for knight distance. Null for every other key or drill.
 */
export function answerForKey(kind: DrillKind, key: string): Answer | null {
  if (kind === "square_colour") {
    const lower = key.toLowerCase();
    if (lower === "l") return "light";
    if (lower === "d") return "dark";
    return null;
  }
  if (kind === "knight_distance" && /^[0-9]$/.test(key)) {
    const count = Number(key);
    return count <= MAX_KNIGHT_DISTANCE ? count : null;
  }
  return null;
}

/** True when a key press belongs to a text field or a modifier shortcut, not to the drill. */
export function isTypingTarget(event: Pick<KeyboardEvent, "target">): boolean {
  const target = event.target;
  if (!target || typeof target !== "object" || !("tagName" in target)) return false;
  const element = target as HTMLElement;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable === true
  );
}

/** Answers from the keyboard while the controls are on screen. */
function useAnswerShortcuts(kind: DrillKind, onSubmit: (answer: Answer) => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isTypingTarget(event)) return;
      const answer = answerForKey(kind, event.key);
      if (answer === null) return;
      event.preventDefault();
      onSubmit(answer);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [kind, onSubmit]);
}

/** Answer controls for one question (presentational): the input depends on the drill kind. */
export default function DrillAnswerInput({ question, onSubmit }: DrillAnswerInputProps) {
  switch (question.kind) {
    case "square_colour":
      return <ColourButtons onSubmit={onSubmit} />;
    case "knight_distance":
      return <DistanceButtons onSubmit={onSubmit} />;
    case "coordinates":
      return (
        <TextAnswer
          label="Square name"
          hint="Type a file and a rank, for example e4"
          parse={(text) => text}
          onSubmit={onSubmit}
        />
      );
    case "diagonals":
      return (
        <TextAnswer
          label="Squares on the diagonal"
          hint="Separate squares with spaces or commas, in any order"
          parse={parseSquareList}
          preview
          onSubmit={onSubmit}
        />
      );
    default:
      return <ExtraDrillAnswer question={question} onSubmit={onSubmit} />;
  }
}

const SQUARE_BUTTON =
  "group relative flex aspect-[4/3] max-h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl text-lg font-semibold tracking-tight outline-none select-none transition-[transform,box-shadow] focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card hover:ring-2 hover:ring-primary/60 motion-safe:active:scale-[0.98] sm:text-xl";

function ColourButtons({ onSubmit }: { onSubmit: (answer: Answer) => void }) {
  useAnswerShortcuts("square_colour", onSubmit);
  return (
    <div role="group" aria-label="Square colour" className="grid w-full max-w-md grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onSubmit("light")}
        aria-keyshortcuts="L"
        className={SQUARE_BUTTON}
        style={{
          backgroundColor: boardTheme.light,
          color: "#0b1220",
          boxShadow: "inset 0 -4px 0 rgb(0 0 0 / 0.12)",
        }}
      >
        Light
        <Kbd className="max-sm:hidden bg-black/15 text-[#0b1220]">L</Kbd>
      </button>
      <button
        type="button"
        onClick={() => onSubmit("dark")}
        aria-keyshortcuts="D"
        className={SQUARE_BUTTON}
        style={{
          backgroundColor: boardTheme.dark,
          color: "#e6edf7",
          boxShadow: "inset 0 -4px 0 rgb(0 0 0 / 0.18)",
        }}
      >
        Dark
        <Kbd className="max-sm:hidden bg-white/15 text-[#e6edf7]">D</Kbd>
      </button>
    </div>
  );
}

function DistanceButtons({ onSubmit }: { onSubmit: (answer: Answer) => void }) {
  useAnswerShortcuts("knight_distance", onSubmit);
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <div
        role="group"
        aria-label="Knight moves"
        className="grid w-full grid-cols-7 gap-1.5 sm:gap-2"
      >
        {KNIGHT_ANSWERS.map((count) => (
          <button
            key={count}
            type="button"
            aria-keyshortcuts={String(count)}
            onClick={() => onSubmit(count)}
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-muted font-mono text-xl font-semibold tabular-nums shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] outline-none transition-[transform,background-color,border-color] select-none hover:border-primary/60 hover:bg-primary/10 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60 motion-safe:active:scale-95 sm:h-16 sm:text-2xl"
          >
            {count}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground max-sm:hidden">
        Press <Kbd>0</Kbd>–<Kbd>6</Kbd> to answer
      </p>
    </div>
  );
}

function TextAnswer({
  label,
  hint,
  parse,
  preview = false,
  onSubmit,
}: {
  label: string;
  hint: string;
  parse: (text: string) => Answer;
  /** Show the typed squares as chips while typing. */
  preview?: boolean;
  onSubmit: (answer: Answer) => void;
}) {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // `autoFocus` alone is skipped when React reuses the node; focus on mount explicitly too.
  useEffect(() => input.current?.focus({ preventScroll: true }), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim() === "") {
      input.current?.focus();
      return;
    }
    onSubmit(parse(text));
  }
  const typed = preview ? parseSquareList(text) : [];

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-2 text-left">
      <Label htmlFor="drill-answer" className="text-muted-foreground">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          ref={input}
          id="drill-answer"
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-describedby={`${DRILL_PROMPT_ID} drill-answer-hint`}
          className="h-14 rounded-xl px-4 font-mono text-xl tracking-wide placeholder:text-muted-foreground/50 md:text-xl"
        />
        <Button type="submit" className="h-14 rounded-xl px-5 text-base">
          Check
        </Button>
      </div>
      {preview && typed.length > 0 ? (
        <div aria-hidden="true" className="flex min-h-7 flex-wrap gap-1.5">
          {typed.map((square, index) => (
            <SquareChip
              key={`${square}-${index}`}
              tone={parseSquare(square) ? "neutral" : "destructive"}
              className="text-sm"
            >
              {square.toLowerCase()}
            </SquareChip>
          ))}
        </div>
      ) : null}
      <p
        id="drill-answer-hint"
        className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground")}
      >
        <span>{hint}</span>
        <span className="inline-flex items-center gap-1 max-sm:hidden">
          <Kbd>Enter</Kbd> to check
        </span>
      </p>
    </form>
  );
}
