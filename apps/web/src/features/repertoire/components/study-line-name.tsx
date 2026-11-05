import { MAX_LINE_NAME_LENGTH } from "@b2c-template/api/lib/repertoire-limits";
import { Button } from "@b2c-template/ui/components/button";
import { Input } from "@b2c-template/ui/components/input";
import { cn } from "@b2c-template/ui/lib/utils";
import { Pencil } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import { lineNameEdit } from "../lib/study-lines";

export type StudyLineNameProps = {
  /** The line's name, null when it has none. */
  name: string | null;
  /** The line's first move in move-numbered SAN (`4. c3`); the hint, and what names the controls. */
  firstMoveLabel: string;
  /** Saves the trimmed name; null clears it. Only called when the name changed. */
  onRename: (name: string | null) => void;
};

/**
 * The heading of a study line (presentational): its name, or a muted placeholder, with the first
 * move as a hint and an inline rename. Enter or leaving the field saves, Escape cancels.
 */
export default function StudyLineName({ name, firstMoveLabel, onRename }: StudyLineNameProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // A key press ends the edit before the field unmounts; this keeps the blur that may follow from
  // saving a second time (or from saving after Escape).
  const finished = useRef(false);

  function start() {
    finished.current = false;
    setDraft(name ?? "");
  }

  function finish(save: boolean) {
    if (finished.current || draft === null) return;
    finished.current = true;
    setDraft(null);
    if (!save) return;
    const edit = lineNameEdit(draft, name);
    if (edit.save) onRename(edit.name);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  }

  if (draft !== null) {
    return (
      <Input
        autoFocus
        value={draft}
        maxLength={MAX_LINE_NAME_LENGTH}
        aria-label={`Name of the line starting ${firstMoveLabel}`}
        autoComplete="off"
        className="h-11 min-w-0 flex-1"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => finish(true)}
      />
    );
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span className={cn("font-medium break-words", name === null && "text-muted-foreground")}>
          {name ?? "Unnamed line"}
        </span>
        <span className="font-mono text-sm text-muted-foreground">{firstMoveLabel}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-11 shrink-0 px-0 text-muted-foreground"
        aria-label={`Rename the line starting ${firstMoveLabel}`}
        onClick={start}
      >
        <Pencil aria-hidden />
      </Button>
    </>
  );
}
