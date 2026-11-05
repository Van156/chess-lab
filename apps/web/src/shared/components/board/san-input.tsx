import { parseMove } from "@b2c-template/chess";
import { Button } from "@b2c-template/ui/components/button";
import { Input } from "@b2c-template/ui/components/input";
import { Label } from "@b2c-template/ui/components/label";
import { useId, useState, type SyntheticEvent } from "react";

export type SanInputProps = {
  fen: string;
  /** Called with the canonical SAN of a legal move; the position is never changed here. */
  onMove: (san: string) => void;
  label?: string;
};

export type MoveTextCheck = { ok: true; san: string } | { ok: false; error: string };

const EMPTY_ERROR = "Type a move, for example Nf3 or e2e4.";
const NOT_LEGAL_ERROR =
  "That is not a legal move here. Check the notation, or add the file or rank if it is ambiguous (for example Nbd2).";

/** Validates typed SAN or UCI against the legal moves of `fen`. Pure, so it is unit-tested. */
export function checkMoveText(fen: string, text: string): MoveTextCheck {
  if (text.trim() === "") return { ok: false, error: EMPTY_ERROR };
  const parsed = parseMove(fen, text);
  return parsed ? { ok: true, san: parsed.san } : { ok: false, error: NOT_LEGAL_ERROR };
}

/** Labelled move field for keyboard users; errors are announced through a live region. */
export default function SanInput({ fen, onMove, label = "Type a move" }: SanInputProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = checkMoveText(fen, text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setText("");
    onMove(result.san);
  }

  return (
    <form data-slot="san-input" className="flex flex-col gap-2" onSubmit={handleSubmit} noValidate>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="text"
          value={text}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-11 flex-1"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          onChange={(event) => {
            setText(event.target.value);
            if (error) setError(null);
          }}
        />
        <Button type="submit" className="min-h-11 min-w-11 px-4">
          Play
        </Button>
      </div>
      <p id={errorId} aria-live="polite" className="min-h-5 text-sm text-destructive">
        {error}
      </p>
    </form>
  );
}
