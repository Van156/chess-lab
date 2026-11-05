import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import BlindfoldDrills from "./blindfold-drills";
import { PLAYED_STATS } from "./drill-progress.fixtures";

const meta = {
  title: "App/Blindfold/BlindfoldDrills",
  component: BlindfoldDrills,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: { drills: DRILL_CATALOG, onStart: () => {} },
} satisfies Meta<typeof BlindfoldDrills>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithStats: Story = { args: { stats: PLAYED_STATS, suggestedKind: "diagonals" } };

export const Mobile: Story = {
  args: { stats: PLAYED_STATS, suggestedKind: "diagonals" },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
