import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import type { PracticeSummary } from "../lib/practice-summary";
import { GUIDE_SECTIONS, TRAINING_PLAN } from "../lib/guide-content";
import type { DrillStat } from "../lib/drill-stats";
import BlindfoldDrills from "./blindfold-drills";
import BlindfoldHero from "./blindfold-hero";
import { ACTIVE_SUMMARY, FIXTURE_TODAY, NEW_SUMMARY } from "./blindfold-hero.fixtures";
import BlindfoldView from "./blindfold-view";
import DrillProgress from "./drill-progress";
import { EMPTY_STATS, PLAYED_STATS } from "./drill-progress.fixtures";

/** The Drills tab as the panel composes it, without the queries. */
function Hub({ summary, stats }: { summary: PracticeSummary; stats: readonly DrillStat[] }) {
  const isNew = summary.totalSessions === 0;
  const suggested = isNew ? DRILL_CATALOG[0]! : DRILL_CATALOG[2]!;
  return (
    <div className="flex flex-col gap-10">
      <BlindfoldHero
        summary={summary}
        suggestion={{ drill: suggested, lastPlayedAt: null }}
        today={FIXTURE_TODAY}
        onStart={() => {}}
      />
      <BlindfoldDrills
        drills={DRILL_CATALOG}
        stats={stats}
        suggestedKind={suggested.kind}
        onStart={() => {}}
      />
      <DrillProgress drills={DRILL_CATALOG} stats={stats} />
    </div>
  );
}

const meta = {
  title: "App/Blindfold/BlindfoldView",
  component: BlindfoldView,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    sections: GUIDE_SECTIONS,
    plan: TRAINING_PLAN,
    drillsPanel: <Hub summary={ACTIVE_SUMMARY} stats={PLAYED_STATS} />,
  },
} satisfies Meta<typeof BlindfoldView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HubWithData: Story = {};

export const BrandNewUser: Story = {
  args: { drillsPanel: <Hub summary={NEW_SUMMARY} stats={EMPTY_STATS} /> },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

export const GuideTab: Story = { args: { defaultTab: "guide" } };
