import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { mistakeItem } from "./mistakes.fixtures";
import MistakesView from "./mistakes-view";

const mistakes = [
  mistakeItem,
  { ...mistakeItem, id: "m2", ply: 24, severity: "blunder", evalLossCp: 620, phase: "middlegame" },
  { ...mistakeItem, id: "m3", ply: 61, severity: "inaccuracy", evalLossCp: 60, phase: "endgame" },
] satisfies (typeof mistakeItem)[];

const meta = {
  title: "App/Mistakes/MistakesView",
  component: MistakesView,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    mistakes,
    filteredByGame: false,
    hasMore: true,
    loadingMore: false,
    onLoadMore: () => {},
  },
} satisfies Meta<typeof MistakesView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMistakes: Story = {};

export const LoadingMore: Story = { args: { loadingMore: true } };

export const OneGame: Story = { args: { filteredByGame: true, hasMore: false } };

export const Empty: Story = { args: { mistakes: [], hasMore: false } };

export const EmptyForGame: Story = { args: { mistakes: [], hasMore: false, filteredByGame: true } };
