import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import { EMPTY_STATS, PLAYED_STATS } from "./drill-progress.fixtures";
import DrillProgress from "./drill-progress";

const meta = {
  title: "App/Blindfold/DrillProgress",
  component: DrillProgress,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: { drills: DRILL_CATALOG, stats: PLAYED_STATS },
} satisfies Meta<typeof DrillProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoSessionsYet: Story = { args: { stats: EMPTY_STATS } };
