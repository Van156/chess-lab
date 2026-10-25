import { Tabs, TabsContent, TabsList, TabsTrigger } from "@b2c-template/ui/components/tabs";

import PageHeader from "@/shared/components/layout/page-header";

import type { DrillInfo } from "../lib/drill-catalog";
import type { GuideSection, PlanWeek } from "../lib/guide-content";
import BlindfoldDrills from "./blindfold-drills";
import BlindfoldGuide from "./blindfold-guide";

export type BlindfoldViewProps = {
  sections: readonly GuideSection[];
  plan: readonly PlanWeek[];
  drills: readonly DrillInfo[];
};

/** Blindfold screen (presentational): the training guide and the drills, as two tabs. */
export default function BlindfoldView({ sections, plan, drills }: BlindfoldViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Blindfold"
        description="Ideas to memorise, techniques to practise and drills that build board vision."
      />
      <Tabs defaultValue="guide">
        <TabsList>
          <TabsTrigger value="guide">Guide</TabsTrigger>
          <TabsTrigger value="drills">Drills</TabsTrigger>
        </TabsList>
        <TabsContent value="guide" className="pt-4">
          <BlindfoldGuide sections={sections} plan={plan} />
        </TabsContent>
        <TabsContent value="drills" className="pt-4">
          <BlindfoldDrills drills={drills} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
