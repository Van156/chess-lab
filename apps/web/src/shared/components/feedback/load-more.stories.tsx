import type { Meta, StoryObj } from "@storybook/react-vite";

import LoadMore from "./load-more";

const meta = {
  title: "App/Feedback/LoadMore",
  component: LoadMore,
  tags: ["autodocs"],
  args: { noun: "games", loading: false, failed: false, onLoadMore: () => {} },
} satisfies Meta<typeof LoadMore>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true } };

export const Failed: Story = { args: { failed: true } };
