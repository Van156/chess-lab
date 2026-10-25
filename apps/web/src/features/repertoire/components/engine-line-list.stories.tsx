import type { Meta, StoryObj } from "@storybook/react-vite";

import EngineLineList from "./engine-line-list";
import { engineLines } from "./repertoire.fixtures";

const meta = {
  title: "App/Repertoire/EngineLineList",
  component: EngineLineList,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    lines: engineLines,
    addPending: false,
    previewRank: null,
    onPreview: () => {},
    onAdd: () => {},
  },
} satisfies Meta<typeof EngineLineList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PreviewingALine: Story = { args: { previewRank: 1 } };

export const SavingAMove: Story = { args: { addPending: true } };

export const LongLines: Story = {
  args: {
    lines: engineLines.map((line) => ({
      ...line,
      moveText: `${line.moveText} 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6`,
    })),
  },
};
