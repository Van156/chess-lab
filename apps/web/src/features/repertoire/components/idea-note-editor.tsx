import { Button } from "@b2c-template/ui/components/button";
import { Input } from "@b2c-template/ui/components/input";
import { Label } from "@b2c-template/ui/components/label";
import { Spinner } from "@b2c-template/ui/components/spinner";
import { useId, useState } from "react";

import { parseArrowInput, parseSquareInput } from "../lib/builder-state";
import {
  describeNote,
  MAX_NOTE_ITEMS,
  MAX_PLAN_LENGTH,
  toggleSquare,
  validatePlan,
} from "../lib/idea-note";
import type { IdeaNote } from "../lib/repertoire-types";

export type IdeaNoteEditorProps = {
  /** The note being edited (the draft); the board shows the same one. */
  note: IdeaNote;
  /** Whether the draft differs from what is saved. */
  dirty: boolean;
  saving?: boolean;
  onChange: (note: IdeaNote) => void;
  /** Saves the draft. The caller reports a failure; the draft stays. */
  onSave: () => void;
  /** Saves an empty note, which removes the stored one. */
  onClear: () => void;
};

const squareInputClass = "min-h-11 w-24";

/** Idea note of the current position: highlights, arrows and a one-line plan, all by keyboard. */
export default function IdeaNoteEditor({
  note,
  dirty,
  saving = false,
  onChange,
  onSave,
  onClear,
}: IdeaNoteEditorProps) {
  const id = useId();
  const [highlight, setHighlight] = useState("");
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [arrowError, setArrowError] = useState<string | null>(null);
  const planError = validatePlan(note.plan);
  const planId = `${id}-plan`;
  const planErrorId = `${planId}-error`;
  const planCountId = `${planId}-count`;

  function addHighlight() {
    const parsed = parseSquareInput(highlight);
    if (!parsed.ok) {
      setHighlightError(parsed.error);
      return;
    }
    if (!note.highlights.includes(parsed.square) && note.highlights.length >= MAX_NOTE_ITEMS) {
      setHighlightError(`A note holds at most ${MAX_NOTE_ITEMS} highlighted squares.`);
      return;
    }
    setHighlightError(null);
    setHighlight("");
    onChange({ ...note, highlights: toggleSquare(note.highlights, parsed.square) });
  }

  function addArrow() {
    const parsed = parseArrowInput(from, to, note.arrows);
    if (!parsed.ok) {
      setArrowError(parsed.error);
      return;
    }
    setArrowError(null);
    setFrom("");
    setTo("");
    onChange({ ...note, arrows: [...note.arrows, parsed.arrow] });
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-5">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Idea note
      </h3>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">In words:</span> {describeNote(note)}
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={planId}>Plan (one line)</Label>
        <Input
          id={planId}
          value={note.plan}
          maxLength={MAX_PLAN_LENGTH}
          autoComplete="off"
          className="min-h-11"
          aria-invalid={planError ? true : undefined}
          aria-describedby={`${planCountId}${planError ? ` ${planErrorId}` : ""}`}
          onChange={(event) => onChange({ ...note, plan: event.target.value })}
        />
        <p id={planCountId} className="text-xs text-muted-foreground">
          {note.plan.length} of {MAX_PLAN_LENGTH} characters
        </p>
        {planError ? (
          <p id={planErrorId} role="alert" className="text-sm text-destructive">
            {planError}
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Highlighted squares</legend>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-highlight`}>Square</Label>
            <Input
              id={`${id}-highlight`}
              value={highlight}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={squareInputClass}
              aria-invalid={highlightError ? true : undefined}
              aria-describedby={`${id}-highlight-error`}
              onChange={(event) => {
                setHighlight(event.target.value);
                setHighlightError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addHighlight();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" className="h-11 px-4" onClick={addHighlight}>
            Toggle highlight
          </Button>
        </div>
        <p id={`${id}-highlight-error`} role="alert" className="min-h-5 text-sm text-destructive">
          {highlightError}
        </p>
        {note.highlights.length > 0 ? (
          <ul aria-label="Highlighted squares" className="flex flex-wrap gap-2">
            {note.highlights.map((square) => (
              <li key={square}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-3 font-mono"
                  aria-label={`Remove highlight ${square}`}
                  onClick={() =>
                    onChange({ ...note, highlights: toggleSquare(note.highlights, square) })
                  }
                >
                  {square} <span aria-hidden>×</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Arrows</legend>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-from`}>From square</Label>
            <Input
              id={`${id}-from`}
              value={from}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={squareInputClass}
              aria-describedby={`${id}-arrow-error`}
              onChange={(event) => {
                setFrom(event.target.value);
                setArrowError(null);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-to`}>To square</Label>
            <Input
              id={`${id}-to`}
              value={to}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={squareInputClass}
              aria-describedby={`${id}-arrow-error`}
              onChange={(event) => {
                setTo(event.target.value);
                setArrowError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addArrow();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" className="h-11 px-4" onClick={addArrow}>
            Add arrow
          </Button>
        </div>
        <p id={`${id}-arrow-error`} role="alert" className="min-h-5 text-sm text-destructive">
          {arrowError}
        </p>
        {note.arrows.length > 0 ? (
          <ul aria-label="Arrows" className="flex flex-wrap gap-2">
            {note.arrows.map((arrow) => (
              <li key={`${arrow.from}-${arrow.to}`}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-3 font-mono"
                  aria-label={`Remove arrow ${arrow.from} to ${arrow.to}`}
                  onClick={() =>
                    onChange({
                      ...note,
                      arrows: note.arrows.filter(
                        (other) => !(other.from === arrow.from && other.to === arrow.to),
                      ),
                    })
                  }
                >
                  {arrow.from}→{arrow.to} <span aria-hidden>×</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-11 px-4"
          disabled={saving || !dirty || planError !== null}
          onClick={onSave}
        >
          {saving ? <Spinner data-icon="inline-start" /> : null}
          Save note
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 px-4"
          disabled={saving}
          onClick={onClear}
        >
          Clear note
        </Button>
      </div>
    </section>
  );
}
