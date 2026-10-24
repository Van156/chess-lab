import type { Meta, StoryObj } from "@storybook/react-vite";

import { c5Move, e4Move, e5Move } from "./repertoire.fixtures";
import LineNavigator from "./line-navigator";

const meta = {
  title: "App/Repertoire/LineNavigator",
  component: LineNavigator,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    path: [e4Move],
    childMoves: [e5Move, c5Move],
    onSelectPly: () => {},
    onSelectChild: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof LineNavigator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithReplies: Story = {};

export const AtStart: Story = { args: { path: [], childMoves: [e4Move] } };

export const EndOfLine: Story = { args: { path: [e4Move, e5Move], childMoves: [] } };
