import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { GUIDE_SECTIONS, TRAINING_PLAN } from "../lib/guide-content";
import BlindfoldGuide from "./blindfold-guide";

const meta = {
  title: "App/Blindfold/BlindfoldGuide",
  component: BlindfoldGuide,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: { sections: GUIDE_SECTIONS, plan: TRAINING_PLAN },
} satisfies Meta<typeof BlindfoldGuide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneSection: Story = { args: { sections: GUIDE_SECTIONS.slice(0, 1) } };
