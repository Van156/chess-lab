import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { mistakeItem } from "./mistakes.fixtures";
import MistakeRow from "./mistake-row";

const meta = {
  title: "App/Mistakes/MistakeRow",
  component: MistakeRow,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: { mistake: mistakeItem },
} satisfies Meta<typeof MistakeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mistake: Story = {};

export const Blunder: Story = {
  args: { mistake: { ...mistakeItem, severity: "blunder", ply: 24, evalLossCp: 620 } },
};

export const InaccuracyNoOpening: Story = {
  args: {
    mistake: {
      ...mistakeItem,
      severity: "inaccuracy",
      phase: "endgame",
      openingName: null,
      eco: null,
      evalLossCp: 60,
    },
  },
};
