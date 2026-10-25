import { Button } from "@b2c-template/ui/components/button";
import { Input } from "@b2c-template/ui/components/input";
import { Kbd } from "@b2c-template/ui/components/kbd";
import { Label } from "@b2c-template/ui/components/label";
import { useEffect, useState, type FormEvent } from "react";

import { parseSquareList } from "../lib/question-text";
import type { Answer, Question } from "../lib/questions";

/** Largest knight distance between two squares of the board. */
const MAX_KNIGHT_DISTANCE = 6;
const KNIGHT_ANSWERS = Array.from({ length: MAX_KNIGHT_DISTANCE + 1 }, (_, index) => index);

export type DrillAnswerInputProps = {
  question: Question;
  onSubmit: (answer: Answer) => void;
};

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
          hint="For example e4"
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
          onSubmit={onSubmit}
        />
      );
  }
}

function ColourButtons({ onSubmit }: { onSubmit: (answer: Answer) => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "l") onSubmit("light");
      if (event.key.toLowerCase() === "d") onSubmit("dark");
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onSubmit]);

  return (
    <div role="group" aria-label="Square colour" className="flex gap-3">
      <Button type="button" size="lg" onClick={() => onSubmit("light")} aria-keyshortcuts="L">
        Light <Kbd>L</Kbd>
      </Button>
      <Button
        type="button"
        size="lg"
        variant="secondary"
        onClick={() => onSubmit("dark")}
        aria-keyshortcuts="D"
      >
        Dark <Kbd>D</Kbd>
      </Button>
    </div>
  );
}

function DistanceButtons({ onSubmit }: { onSubmit: (answer: Answer) => void }) {
  return (
    <div role="group" aria-label="Knight moves" className="flex flex-wrap gap-2">
      {KNIGHT_ANSWERS.map((count) => (
        <Button
          key={count}
          type="button"
          variant="outline"
          size="lg"
          className="min-w-11"
          onClick={() => onSubmit(count)}
        >
          {count}
        </Button>
      ))}
    </div>
  );
}

function TextAnswer({
  label,
  hint,
  parse,
  onSubmit,
}: {
  label: string;
  hint: string;
  parse: (text: string) => Answer;
  onSubmit: (answer: Answer) => void;
}) {
  const [text, setText] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(parse(text));
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Label htmlFor="drill-answer">{label}</Label>
      <div className="flex gap-2">
        <Input
          id="drill-answer"
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby="drill-answer-hint"
          size="lg"
        />
        <Button type="submit" size="lg">
          Check
        </Button>
      </div>
      <p id="drill-answer-hint" className="text-sm text-muted-foreground">
        {hint}
      </p>
    </form>
  );
}
