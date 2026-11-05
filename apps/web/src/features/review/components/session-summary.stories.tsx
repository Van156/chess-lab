import type { Meta, StoryObj } from "@storybook/react-vite";

import SessionSummary from "./session-summary";

const meta = {
  title: "App/Review/SessionSummary",
  component: SessionSummary,
  tags: ["autodocs"],
  args: {
    summary: { cards: 11, answers: 12, byGrade: { 1: 1, 2: 2, 3: 7, 4: 2 }, durationMs: 412_000 },
    action: <a href="/today">Back to Today</a>,
  },
} satisfies Meta<typeof SessionSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {};

export const Empty: Story = {
  args: { summary: { cards: 0, answers: 0, byGrade: { 1: 0, 2: 0, 3: 0, 4: 0 }, durationMs: 0 } },
};
