import { Button } from "@b2c-template/ui/components/button";
import { Label } from "@b2c-template/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@b2c-template/ui/components/radio-group";
import { Spinner } from "@b2c-template/ui/components/spinner";
import { useId, useState, type FormEvent } from "react";

import { validateRepertoireName } from "../lib/repertoire-name";
import type { RepertoireColor } from "../lib/repertoire-types";
import RepertoireNameField from "./repertoire-name-field";

export type CreateRepertoireFormProps = {
  /** Rejects when the server refuses; the caller reports it and the typed name stays. */
  onCreate: (input: { color: RepertoireColor; name: string }) => Promise<unknown>;
};

const COLORS: readonly { value: RepertoireColor; label: string }[] = [
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
];

/** New repertoire: the side you play and a name (presentational; the form state is local UI state). */
export default function CreateRepertoireForm({ onCreate }: CreateRepertoireFormProps) {
  const id = useId();
  const [color, setColor] = useState<RepertoireColor>("white");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateRepertoireName(name);
    setError(problem);
    if (problem) {
      return;
    }
    setPending(true);
    try {
      await onCreate({ color, name: name.trim() });
      setName("");
    } catch {
      // The caller already reported the failure; keep the input so the user can retry.
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="New repertoire" className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Play as</legend>
        <RadioGroup
          value={color}
          onValueChange={(next) => setColor(next as RepertoireColor)}
          className="flex w-full gap-4"
          aria-label="Play as"
        >
          {COLORS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`${id}-${option.value}`}
              className="min-h-11 cursor-pointer"
            >
              <RadioGroupItem id={`${id}-${option.value}`} value={option.value} />
              {option.label}
            </Label>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start">
        <RepertoireNameField
          id={`${id}-name`}
          label="Name"
          value={name}
          onChange={setName}
          error={error}
          disabled={pending}
        />
        <Button type="submit" disabled={pending} className="h-11 px-6 sm:mt-[1.625rem]">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Create repertoire
        </Button>
      </div>
    </form>
  );
}
