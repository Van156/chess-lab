import type { Meta, StoryObj } from "@storybook/react-vite";

import BaseLineHeader from "./base-line-header";
import { e4Move, e5Move } from "./repertoire.fixtures";

const meta = {
  title: "App/Repertoire/BaseLineHeader",
  component: BaseLineHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    baseLine: [],
    startPositionId: "p0",
    basePositionId: null,
    currentPositionId: "p1",
    saving: false,
    onSelect: () => {},
    onSetBase: () => {},
    onClearBase: () => {},
  },
} satisfies Meta<typeof BaseLineHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No base: "Start position", and the current position can become the base. */
export const NoBase: Story = {};

export const AtStart: Story = { args: { currentPositionId: "p0" } };

/** A base is set and the board is elsewhere: both actions show. */
export const WithBase: Story = {
  args: { baseLine: [e4Move, e5Move], basePositionId: "p2" },
};

export const AtBase: Story = {
  args: { baseLine: [e4Move, e5Move], basePositionId: "p2", currentPositionId: "p2" },
};

export const Saving: Story = {
  args: { baseLine: [e4Move, e5Move], basePositionId: "p2", saving: true },
};
