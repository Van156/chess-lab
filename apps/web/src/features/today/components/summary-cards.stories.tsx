import type { Meta, StoryObj } from "@storybook/react-vite";

import SummaryCards from "./summary-cards";

const meta = {
  title: "App/Today/SummaryCards",
  component: SummaryCards,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { newBudgetLeft: 5, streak: { days: 6, reviewedToday: true } },
} satisfies Meta<typeof SummaryCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StreakKept: Story = {};

export const StreakAtRisk: Story = {
  args: { streak: { days: 6, reviewedToday: false } },
};

export const NoStreak: Story = {
  args: { newBudgetLeft: 0, streak: { days: 0, reviewedToday: false } },
};
