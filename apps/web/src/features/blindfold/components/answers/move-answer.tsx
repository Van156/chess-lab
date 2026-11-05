import { Button } from "@b2c-template/ui/components/button";
import { Input } from "@b2c-template/ui/components/input";
import { Label } from "@b2c-template/ui/components/label";
import { useState, type FormEvent } from "react";

export type MoveAnswerProps = {
  onSubmit: (answer: string) => void;
};

/** A typed SAN move with a Check button; empty input is not submitted. */
export default function MoveAnswer({ onSubmit }: MoveAnswerProps) {
  const [text, setText] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const move = text.trim();
    if (move !== "") onSubmit(move);
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Label htmlFor="drill-move">Mating move</Label>
      <div className="flex gap-2">
        <Input
          id="drill-move"
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-describedby="drill-move-hint"
          size="lg"
          className="max-w-56 font-mono text-base tracking-wide"
        />
        <Button type="submit" size="lg">
          Check
        </Button>
      </div>
      <p id="drill-move-hint" className="text-sm text-muted-foreground">
        Type the move, for example <span className="font-mono text-foreground">Qh7</span> or{" "}
        <span className="font-mono text-foreground">Rxe8</span>.
      </p>
    </form>
  );
}
