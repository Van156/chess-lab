import { Badge } from "@b2c-template/ui/components/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@b2c-template/ui/components/card";

import type { DrillInfo } from "../lib/drill-catalog";

/** Drill picker (presentational). The drills become playable in a later slice; for now they are described. */
export default function BlindfoldDrills({ drills }: { drills: readonly DrillInfo[] }) {
  return (
    <ul aria-label="Drills" className="grid gap-4 sm:grid-cols-2">
      {drills.map((drill) => (
        <li key={drill.kind}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {drill.label}
                <Badge variant="outline">Coming next</Badge>
              </CardTitle>
              <CardDescription>{drill.description}</CardDescription>
              <p className="text-sm text-muted-foreground">Example: {drill.example}</p>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
