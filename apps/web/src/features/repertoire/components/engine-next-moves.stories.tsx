import type { Meta, StoryObj } from "@storybook/react-vite";

import EngineNextMoves from "./engine-next-moves";
import { engineLines } from "./repertoire.fixtures";

const meta = {
  title: "App/Repertoire/EngineNextMoves",
  component: EngineNextMoves,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    state: { kind: "done", depth: 18, maxDepth: 18, lines: engineLines },
    addPending: false,
    previewRank: null,
    onPreview: () => {},
    onAdd: () => {},
  },
} satisfies Meta<typeof EngineNextMoves>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {};

export const Analysing: Story = {
  args: { state: { kind: "analysing", depth: 11, maxDepth: 18, lines: engineLines } },
};

export const AnalysingWithoutLines: Story = {
  args: { state: { kind: "analysing", depth: 1, maxDepth: 18, lines: [] } },
};

export const PreviewingALine: Story = { args: { previewRank: 1 } };

export const Starting: Story = { args: { state: { kind: "starting" } } };

export const Off: Story = { args: { state: { kind: "off" } } };

export const SavingAMove: Story = { args: { addPending: true } };

export const NoSuggestion: Story = {
  args: { state: { kind: "done", depth: 18, maxDepth: 18, lines: [] } },
};

export const Unavailable: Story = { args: { state: { kind: "unavailable" } } };
