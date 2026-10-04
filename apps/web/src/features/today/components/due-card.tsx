import { Card } from "@b2c-template/ui/components/card";
import type { ReactNode } from "react";

import type { DuePart } from "../lib/today-view-model";

/** The review queue: how many cards are due, split per pillar, and the start action (slot). */
export default function DueCard({
  total,
  parts,
  action,
}: {
  total: number;
  parts: DuePart[];
  /** The "Start review" call to action; the container decides what it links to. */
  action: ReactNode;
}) {
  return (
    <Card aria-labelledby="today-queue-title" role="region" className="rounded-2xl p-4 md:p-6">
      <h2
        id="today-queue-title"
        className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Today's review
      </h2>
      <p className="text-5xl font-bold tracking-tight">
        {total} <span className="text-xl font-medium text-muted-foreground">due</span>
      </p>
      {parts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {parts.map((part) => (
            <li key={part.key} className="rounded-full border px-3 py-1 text-sm">
              <span className="font-semibold text-primary">{part.count}</span> {part.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div>{action}</div>
    </Card>
  );
}
