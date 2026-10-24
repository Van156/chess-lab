import { Label } from "@b2c-template/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@b2c-template/ui/components/native-select";
import { useId } from "react";

import { bandOptions } from "../lib/explorer-band-options";

export type ExplorerBandSelectProps = {
  /** The band of the user's rating, unshifted; every option is placed relative to it. */
  ownBand: number;
  /** The band the stats on screen use. */
  band: number;
  /** A change is being saved; the select is busy until the new stats are in. */
  pending: boolean;
  onChange: (offset: number) => void;
};

/** Rating band choice (presentational): a labelled native select from two bands below to two above. */
export default function ExplorerBandSelect({
  ownBand,
  band,
  pending,
  onChange,
}: ExplorerBandSelectProps) {
  const id = useId();
  const options = bandOptions(ownBand);
  const selected = options.find((option) => option.band === band)?.offset ?? 0;
  return (
    <div data-slot="explorer-band-select" className="flex flex-wrap items-center gap-2">
      <Label htmlFor={id}>Compare with rating band</Label>
      <NativeSelect
        id={id}
        value={selected}
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
