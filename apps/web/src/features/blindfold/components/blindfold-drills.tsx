import { Button } from "@b2c-template/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@b2c-template/ui/components/card";
import { useState } from "react";

import type { DrillInfo } from "../lib/drill-catalog";
import type { DrillKind } from "../lib/questions";

export const DRILL_LEVELS = [1, 2, 3] as const;
export const DEFAULT_LEVEL = 1;

export type BlindfoldDrillsProps = {
  drills: readonly DrillInfo[];
  onStart: (kind: DrillKind, level: number) => void;
};

/** Drill picker (presentational): one card per drill, each with a level and a Start button. */
export default function BlindfoldDrills({ drills, onStart }: BlindfoldDrillsProps) {
  const [levels, setLevels] = useState<Partial<Record<DrillKind, number>>>({});
  return (
    <ul aria-label="Drills" className="grid gap-4 sm:grid-cols-2">
      {drills.map((drill) => {
        const level = levels[drill.kind] ?? DEFAULT_LEVEL;
        return (
          <li key={drill.kind}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{drill.label}</CardTitle>
                <CardDescription>{drill.description}</CardDescription>
                <p className="text-sm text-muted-foreground">Example: {drill.example}</p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <div role="group" aria-label={`${drill.label} level`} className="flex gap-1">
                    {DRILL_LEVELS.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={option === level ? "default" : "outline"}
                        aria-pressed={option === level}
                        onClick={() =>
                          setLevels((current) => ({ ...current, [drill.kind]: option }))
                        }
                      >
                        Level {option}
                      </Button>
                    ))}
                  </div>
                  <Button type="button" onClick={() => onStart(drill.kind, level)}>
                    Start
                    <span className="sr-only"> {drill.label}</span>
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
