import { Tabs, TabsContent, TabsList, TabsTrigger } from "@b2c-template/ui/components/tabs";
import { BookOpen, Target } from "lucide-react";
import type { ReactNode } from "react";

import PageHeader from "@/shared/components/layout/page-header";

import type { GuideSection, PlanWeek } from "../lib/guide-content";
import type { DrillKind } from "../lib/questions";
import BlindfoldGuide from "./blindfold-guide";

export type BlindfoldViewProps = {
  sections: readonly GuideSection[];
  plan: readonly PlanWeek[];
  /** The Drills tab: hero, picker, player and progress. */
  drillsPanel: ReactNode;
  /** The tab shown first; defaults to the drills. Ignored when `tab` is given. */
  defaultTab?: BlindfoldTab;
  /** The tab on screen, when the container controls it. */
  tab?: BlindfoldTab;
  onTabChange?: (tab: BlindfoldTab) => void;
  /** Starts a drill from the guide's "Practise with" chips. */
  onPractise?: (kind: DrillKind) => void;
};

export type BlindfoldTab = "guide" | "drills";

const TRIGGER =
  "h-10 flex-none gap-2 rounded-none px-1 text-sm font-medium group-data-horizontal/tabs:after:bottom-[-1px] after:bg-primary data-active:text-foreground";

/** Blindfold screen (presentational): the drills and the training guide, as two tabs. */
export default function BlindfoldView({
  sections,
  plan,
  drillsPanel,
  defaultTab = "drills",
  tab,
  onTabChange,
  onPractise,
}: BlindfoldViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
      <PageHeader
        title="Blindfold"
        description="Train the board in your head: short drills for geometry, piece vision and memory."
      />
      <Tabs
        {...(tab === undefined ? { defaultValue: defaultTab } : { value: tab })}
        onValueChange={(value) => onTabChange?.(value as BlindfoldTab)}
        className="gap-6"
      >
        <TabsList
          variant="line"
          className="w-full justify-start gap-6 rounded-none border-b p-0 group-data-horizontal/tabs:h-auto"
        >
          <TabsTrigger value="drills" className={TRIGGER}>
            <Target aria-hidden />
            Drills
          </TabsTrigger>
          <TabsTrigger value="guide" className={TRIGGER}>
            <BookOpen aria-hidden />
            Guide
          </TabsTrigger>
        </TabsList>
        <TabsContent value="drills">{drillsPanel}</TabsContent>
        <TabsContent value="guide">
          <BlindfoldGuide sections={sections} plan={plan} onPractise={onPractise} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
