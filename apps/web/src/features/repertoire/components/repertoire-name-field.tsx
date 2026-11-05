import { Input } from "@b2c-template/ui/components/input";
import { Label } from "@b2c-template/ui/components/label";
import { cn } from "@b2c-template/ui/lib/utils";

import { REPERTOIRE_NAME_MAX_LENGTH } from "@b2c-template/api/lib/repertoire-limits";

export type RepertoireNameFieldProps = {
  /** Unique within the page; the error text gets `${id}-error`. */
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Validation message shown below the input; announced and tied to it with `aria-describedby`. */
  error?: string | null;
  /** Keep the label for assistive technology only (inline rename). */
  hideLabel?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
};

/** Labelled name input with its validation message (presentational). */
export default function RepertoireNameField({
  id,
  label,
  value,
  onChange,
  error = null,
  hideLabel = false,
  autoFocus = false,
  disabled = false,
}: RepertoireNameFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-11"
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p className="sr-only">Up to {REPERTOIRE_NAME_MAX_LENGTH} characters.</p>
      )}
    </div>
  );
}
