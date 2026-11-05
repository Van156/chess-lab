import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import DrillProgress from "./drill-progress";
import { EMPTY_STATS, PLAYED_STATS, PROGRESS_NOW } from "./drill-progress.fixtures";

const meta = {
  title: "App/Blindfold/DrillProgress",
  component: DrillProgress,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: { drills: DRILL_CATALOG, stats: PLAYED_STATS, now: PROGRESS_NOW },
} satisfies Meta<typeof DrillProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Six of eight drills played; two not started yet. */
export const Played: Story = {};

export const Empty: Story = { args: { stats: EMPTY_STATS } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
