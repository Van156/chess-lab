import { Tabs, TabsContent, TabsList, TabsTrigger } from "@b2c-template/ui/components/tabs";
import type { ReactNode } from "react";

import PageHeader from "@/shared/components/layout/page-header";

import type { GuideSection, PlanWeek } from "../lib/guide-content";
import BlindfoldGuide from "./blindfold-guide";

export type BlindfoldViewProps = {
  sections: readonly GuideSection[];
  plan: readonly PlanWeek[];
  /** The Drills tab: picker, player and progress. */
  drillsPanel: ReactNode;
  /** The tab shown first; defaults to the guide. */
  defaultTab?: "guide" | "drills";
};

/** Blindfold screen (presentational): the training guide and the drills, as two tabs. */
export default function BlindfoldView({
  sections,
  plan,
  drillsPanel,
  defaultTab = "guide",
}: BlindfoldViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Blindfold"
        description="Ideas to memorise, techniques to practise and drills that build board vision."
      />
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="guide">Guide</TabsTrigger>
          <TabsTrigger value="drills">Drills</TabsTrigger>
        </TabsList>
        <TabsContent value="guide" className="pt-4">
          <BlindfoldGuide sections={sections} plan={plan} />
        </TabsContent>
        <TabsContent value="drills" className="pt-4">
          {drillsPanel}
        </TabsContent>
      </Tabs>
    </div>
  );
}
