import type { Meta, StoryObj } from "@storybook/react-vite";

import BoardToolbar from "./board-toolbar";

const meta = {
  title: "App/Repertoire/BoardToolbar",
  component: BoardToolbar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    lineCount: 3,
    onChangeLineCount: () => {},
    showRepertoireArrows: true,
    onToggleRepertoireArrows: () => {},
  },
} satisfies Meta<typeof BoardToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeLines: Story = {};

export const OneLine: Story = { args: { lineCount: 1 } };

export const RepertoireArrowsOff: Story = { args: { showRepertoireArrows: false } };
