import type { Meta, StoryObj } from "@storybook/react-vite";

import { e4Move, e5Move } from "./repertoire.fixtures";
import LineNavigator from "./line-navigator";

const meta = {
  title: "App/Repertoire/LineNavigator",
  component: LineNavigator,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    path: [e4Move],
    onSelectPly: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof LineNavigator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidLine: Story = {};

export const AtStart: Story = { args: { path: [] } };

export const EndOfLine: Story = { args: { path: [e4Move, e5Move] } };
