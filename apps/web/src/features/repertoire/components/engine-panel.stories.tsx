import type { Meta, StoryObj } from "@storybook/react-vite";

import EnginePanel from "./engine-panel";
import { engineLines } from "./repertoire.fixtures";

const meta = {
  title: "App/Repertoire/EnginePanel",
  component: EnginePanel,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    state: { kind: "done", depth: 18, maxDepth: 18, lines: engineLines },
    addPending: false,
    onToggle: () => {},
    onAdd: () => {},
    onRetry: () => {},
  },
} satisfies Meta<typeof EnginePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {};

export const Analysing: Story = {
  args: { state: { kind: "analysing", depth: 11, maxDepth: 18, lines: engineLines } },
};

export const Starting: Story = { args: { state: { kind: "starting" } } };

export const Off: Story = { args: { state: { kind: "off" } } };

export const SavingAMove: Story = { args: { addPending: true } };

export const Unavailable: Story = { args: { state: { kind: "unavailable" } } };

export const NoLegalMoves: Story = { args: { state: { kind: "terminal" } } };

export const LongLines: Story = {
  args: {
    state: {
      kind: "done",
      depth: 18,
      maxDepth: 18,
      lines: engineLines.map((line) => ({
        ...line,
        moveText: `${line.moveText} 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6`,
      })),
    },
  },
};
