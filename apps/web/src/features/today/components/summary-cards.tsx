import { Card } from "@b2c-template/ui/components/card";
import { Flame, Sparkles } from "lucide-react";

import { streakMessage } from "../lib/today-view-model";
import type { TodaySummary } from "../lib/today-types";

/** New-card allowance left today and the review streak. */
export default function SummaryCards({
  newBudgetLeft,
  streak,
}: {
  newBudgetLeft: number;
  streak: TodaySummary["streak"];
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      <li>
        <Card size="sm" className="h-full rounded-2xl px-4">
          <h3 className="text-sm font-semibold text-muted-foreground">New cards left today</h3>
          <p className="flex items-center gap-2 text-3xl font-bold">
            <Sparkles className="size-5 text-primary" aria-hidden />
            {newBudgetLeft}
          </p>
        </Card>
      </li>
      <li>
        <Card size="sm" className="h-full rounded-2xl px-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Streak</h3>
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Flame className="size-5 shrink-0 text-primary" aria-hidden />
            {streakMessage(streak)}
          </p>
        </Card>
      </li>
    </ul>
  );
}
