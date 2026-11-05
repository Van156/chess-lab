import type { Meta, StoryObj } from "@storybook/react-vite";

import EvalBar from "./eval-bar";

const meta = {
  title: "App/Repertoire/EvalBar",
  component: EvalBar,
  tags: ["autodocs"],
  args: { whitePercent: 50, orientation: "white" },
  decorators: [
    (Story) => (
      <div className="h-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EvalBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Equal: Story = {};

export const NoScore: Story = { args: { whitePercent: null } };

export const WhiteBetter: Story = { args: { whitePercent: 68 } };

export const BlackBetter: Story = { args: { whitePercent: 24 } };

export const WhiteMates: Story = { args: { whitePercent: 100 } };

export const BlackMates: Story = { args: { whitePercent: 0 } };

/** From Black's side the bar is flipped: White's share grows from the top. */
export const BlackOrientation: Story = { args: { whitePercent: 68, orientation: "black" } };
