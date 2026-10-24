import { Label } from "@b2c-template/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@b2c-template/ui/components/native-select";
import { useId } from "react";

import { bandOptions } from "../lib/explorer-band-options";

export type ExplorerBandSelectProps = {
  /** The band of the user's rating, unshifted; every option is placed relative to it. */
  ownBand: number;
  /** The saved offset from the own band; it can be clamped, so it is not the band on screen. */
  offset: number;
  /** A change is being saved; the select is busy until the new stats are in. */
  pending: boolean;
  onChange: (offset: number) => void;
};

/** Rating band choice (presentational): a labelled native select from two bands below to two above. */
export default function ExplorerBandSelect({
  ownBand,
  offset,
  pending,
  onChange,
}: ExplorerBandSelectProps) {
  const id = useId();
  const options = bandOptions(ownBand, offset);
  return (
    <div data-slot="explorer-band-select" className="flex flex-wrap items-center gap-2">
      <Label htmlFor={id}>Compare with rating band</Label>
      <NativeSelect
        id={id}
        value={offset}
        disabled={pending}
        aria-busy={pending || undefined}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.offset} value={option.offset}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {pending ? (
        <span role="status" className="text-muted-foreground">
          Saving band…
        </span>
      ) : null}
    </div>
  );
}
