import type { Meta, StoryObj } from "@storybook/react-vite";

import AnalysisStatusView from "./analysis-status-view";

const meta = {
  title: "App/Engine/AnalysisStatusView",
  component: AnalysisStatusView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    onResume: () => {},
    status: { phase: "running", stage: "screen", done: 24, total: 60, analysed: 0 },
  },
} satisfies Meta<typeof AnalysisStatusView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Screening: Story = {};

export const Confirming: Story = {
  args: { status: { phase: "running", stage: "confirm", done: 3, total: 8, analysed: 1 } },
};

export const Paused: Story = {
  args: { status: { phase: "paused", stage: "screen", done: 24, total: 60, analysed: 0 } },
};

export const Stopped: Story = { args: { status: { phase: "stopped", analysed: 1 } } };

export const EngineUnavailable: Story = { args: { status: { phase: "unavailable", analysed: 0 } } };

export const Failed: Story = { args: { status: { phase: "failed", analysed: 0 } } };

export const Finished: Story = { args: { status: { phase: "finished", analysed: 3 } } };
