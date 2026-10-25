import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@b2c-template/ui/components/accordion";
import { Badge } from "@b2c-template/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@b2c-template/ui/components/table";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import type { GuideSection, PlanWeek } from "../lib/guide-content";

export type BlindfoldGuideProps = {
  sections: readonly GuideSection[];
  plan: readonly PlanWeek[];
};

const drillLabels = new Map(DRILL_CATALOG.map((drill) => [drill.kind, drill.label]));

/** Training guide (presentational): collapsible sections of ideas, then the weekly plan. */
export default function BlindfoldGuide({ sections, plan }: BlindfoldGuideProps) {
  const [first] = sections;
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="blindfold-ideas" className="flex flex-col gap-2">
        <h2 id="blindfold-ideas" className="text-lg font-semibold">
          Ideas and techniques
        </h2>
        <Accordion defaultValue={first ? [first.id] : []}>
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger>{section.title}</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2 text-muted-foreground">{section.summary}</p>
                <ul className="list-disc space-y-1 pl-5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <section aria-labelledby="blindfold-plan" className="flex flex-col gap-2">
        <h2 id="blindfold-plan" className="text-lg font-semibold">
          Four-week training plan
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week</TableHead>
              <TableHead>Focus</TableHead>
              <TableHead>Each day</TableHead>
              <TableHead>Drills</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.map((week) => (
              <TableRow key={week.week}>
                <TableCell className="font-medium">Week {week.week}</TableCell>
                <TableCell className="whitespace-normal">{week.focus}</TableCell>
                <TableCell className="whitespace-normal">{week.daily}</TableCell>
                <TableCell>
                  {week.drills.length === 0 ? (
                    <span className="text-muted-foreground">Away from the drills</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {week.drills.map((kind) => (
                        <Badge key={kind} variant="secondary">
                          {drillLabels.get(kind) ?? kind}
                        </Badge>
                      ))}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
