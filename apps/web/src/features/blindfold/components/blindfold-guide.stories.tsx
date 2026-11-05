import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { GUIDE_SECTIONS, TRAINING_PLAN } from "../lib/guide-content";
import BlindfoldGuide from "./blindfold-guide";

const meta = {
  title: "App/Blindfold/BlindfoldGuide",
  component: BlindfoldGuide,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    // The guide sits in the Blindfold view's column.
    (Story) => (
      <div className="mx-auto w-full max-w-4xl">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
  args: { sections: GUIDE_SECTIONS, plan: TRAINING_PLAN },
} satisfies Meta<typeof BlindfoldGuide>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole guide, read-only chips. */
export const Default: Story = {};

/** With `onPractise`, the drill chips start a drill. */
export const WithPractise: Story = { args: { onPractise: () => {} } };

export const OneSection: Story = {
  args: { sections: GUIDE_SECTIONS.slice(4, 5), plan: [], onPractise: () => {} },
};

export const Mobile: Story = {
  args: { onPractise: () => {} },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
