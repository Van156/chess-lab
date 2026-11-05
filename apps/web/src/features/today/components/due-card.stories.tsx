import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import DueCard from "./due-card";
import StartReviewButton from "./start-review-button";

const meta = {
  title: "App/Today/DueCard",
  component: DueCard,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    total: 12,
    parts: [{ key: "mistakes", label: "Mistakes", count: 12 }],
    action: <StartReviewButton to="/today" />,
  },
} satisfies Meta<typeof DueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnlyNewCards: Story = { args: { total: 0, parts: [] } };

export const ActionUnavailable: Story = { args: { action: <StartReviewButton /> } };
