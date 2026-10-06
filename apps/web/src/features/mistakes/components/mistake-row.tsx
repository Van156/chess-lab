import { Card } from "@b2c-template/ui/components/card";
import { Link } from "@tanstack/react-router";

import { moveLabel, pawns, phaseLabel, severityLabel } from "../lib/mistake-format";
import type { MistakeItem } from "../lib/mistakes-types";

/**
 * One mistake in the list. The whole card is one link to the detail, named by its content, so a
 * keyboard or screen reader user gets a single stop per mistake.
 */
export default function MistakeRow({ mistake }: { mistake: MistakeItem }) {
  return (
    <Link
      to="/mistakes/$id"
      params={{ id: mistake.id }}
      className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="flex min-h-11 flex-col gap-1 rounded-2xl p-4 hover:bg-muted/40">
        <p className="font-semibold">
          {severityLabel(mistake.severity)}: {moveLabel(mistake.ply, mistake.playedSan)}
        </p>
        <p className="text-sm">
          Best was <span className="font-mono">{mistake.bestSan}</span>, about{" "}
          {pawns(mistake.evalLossCp)} pawns lost
        </p>
        <p className="text-sm text-muted-foreground">
          {phaseLabel(mistake.phase)}
          {mistake.openingName ? `, ${mistake.openingName}` : ""}
          {" · "}
          <time dateTime={mistake.playedAt.toISOString()}>
            {mistake.playedAt.toISOString().slice(0, 10)}
          </time>
        </p>
      </Card>
    </Link>
  );
}
