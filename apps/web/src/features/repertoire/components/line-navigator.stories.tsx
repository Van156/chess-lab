import type { Meta, StoryObj } from "@storybook/react-vite";

import { e4Move, e5Move } from "./repertoire.fixtures";
import LineNavigator from "./line-navigator";

const nf3 = { ...e5Move, id: "m9", fromPositionId: "p2", toPositionId: "p9", san: "Nf3" };

const meta = {
  title: "App/Repertoire/LineNavigator",
  component: LineNavigator,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    path: [e4Move],
    basePositionId: null,
    onSelectPly: () => {},
    onDelete: () => {},
    keysActive: true,
  },
} satisfies Meta<typeof LineNavigator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidLine: Story = {};

export const AtStart: Story = { args: { path: [] } };

export const EndOfLine: Story = { args: { path: [e4Move, e5Move] } };

/** Past a base of 1. e4 e5: the base moves collapse into one chip, Start stays first. */
export const PastTheBase: Story = {
  args: { path: [e4Move, e5Move, nf3], basePositionId: "p2" },
};

export const AtTheBase: Story = { args: { path: [e4Move, e5Move], basePositionId: "p2" } };

export const WhilePreviewing: Story = { args: { path: [e4Move, e5Move], keysActive: false } };
