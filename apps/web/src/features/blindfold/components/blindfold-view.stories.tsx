import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import { GUIDE_SECTIONS, TRAINING_PLAN } from "../lib/guide-content";
import BlindfoldView from "./blindfold-view";

const meta = {
  title: "App/Blindfold/BlindfoldView",
  component: BlindfoldView,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: { sections: GUIDE_SECTIONS, plan: TRAINING_PLAN, drills: DRILL_CATALOG },
} satisfies Meta<typeof BlindfoldView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
