import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { FINISHED_SUMMARY } from "./drill-player.fixtures";
import DrillResults from "./drill-results";
import { knightReview, PERFECT_SUMMARY, RESULTS } from "./drill-results.fixtures";

const meta = {
  title: "App/Blindfold/DrillResults",
  component: DrillResults,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    label: "Knight distance",
    summary: FINISHED_SUMMARY,
    saveStatus: "saved",
    results: RESULTS,
    previousBest: 0.9,
    onRetrySave: () => {},
    onPlayAgain: () => {},
    onBack: () => {},
  },
} satisfies Meta<typeof DrillResults>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PersonalBest: Story = { args: { previousBest: 0.7 } };

export const PerfectScore: Story = {
  args: {
    summary: PERFECT_SUMMARY,
    results: Array.from({ length: 20 }, () => true),
    previousBest: 0.95,
  },
};

export const Saving: Story = { args: { saveStatus: "saving" } };

export const SaveFailed: Story = { args: { saveStatus: "error" } };

/** Collapsed to the three mistakes; "Show all 20" lists every question. */
export const WithReview: Story = { args: { review: knightReview() } };

export const Mobile: Story = {
  args: { review: knightReview(), previousBest: 0.7 },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
