import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { FINISHED_SUMMARY } from "./drill-player.fixtures";
import DrillResults from "./drill-results";

const meta = {
  title: "App/Blindfold/DrillResults",
  component: DrillResults,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    label: "Square colour",
    summary: FINISHED_SUMMARY,
    onPlayAgain: () => {},
    onBack: () => {},
  },
} satisfies Meta<typeof DrillResults>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
