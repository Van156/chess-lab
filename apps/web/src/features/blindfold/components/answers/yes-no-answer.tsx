import { Button } from "@b2c-template/ui/components/button";
import { Kbd } from "@b2c-template/ui/components/kbd";
import { Check, X } from "lucide-react";

import type { YesNo } from "../../lib/drills/types";
import { useAnswerKeys } from "./use-answer-keys";

export type YesNoAnswerProps = {
  /** Accessible name of the button group, e.g. "Same diagonal". */
  label: string;
  onSubmit: (answer: YesNo) => void;
};

const OPTIONS = [
  { value: "yes", text: "Yes", key: "Y", Icon: Check },
  { value: "no", text: "No", key: "N", Icon: X },
] as const;

/** The answer a key press gives (lower-case key), or `null` when the key is not a shortcut. */
export function yesNoForKey(key: string, shift: boolean): YesNo | null {
  if (shift) return null;
  return OPTIONS.find((option) => option.key.toLowerCase() === key)?.value ?? null;
}

/** Two large Yes/No buttons, also answered with the Y and N keys. */
export default function YesNoAnswer({ label, onSubmit }: YesNoAnswerProps) {
  useAnswerKeys((key, shift) => {
    const answer = yesNoForKey(key, shift);
    if (answer === null) return false;
    onSubmit(answer);
    return true;
  });

  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-3 sm:flex">
      {OPTIONS.map(({ value, text, key, Icon }) => (
        <Button
          key={value}
          type="button"
          variant="outline"
          aria-keyshortcuts={key}
          onClick={() => onSubmit(value)}
          className="h-14 justify-center gap-3 rounded-lg px-4 text-base sm:min-w-40 sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <Icon aria-hidden className="size-5! text-muted-foreground" />
            {text}
          </span>
          <Kbd aria-hidden className="hidden sm:inline-flex">
            {key}
          </Kbd>
        </Button>
      ))}
    </div>
  );
}
