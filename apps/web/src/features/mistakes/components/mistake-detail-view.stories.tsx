import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { mistakeDetail } from "./mistakes.fixtures";
import MistakeDetailView from "./mistake-detail-view";

const meta = {
  title: "App/Mistakes/MistakeDetailView",
  component: MistakeDetailView,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: { mistake: mistakeDetail, moves: ["e4", "e5", "a3"] },
} satisfies Meta<typeof MistakeDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AsWhite: Story = {};

export const AsBlack: Story = {
  args: {
    mistake: {
      ...mistakeDetail,
      ply: 6,
      playedSan: "a6",
      playedUci: "a7a6",
      bestSan: "Nc6",
      bestUci: "b8c6",
      game: { ...mistakeDetail.game, userColor: "black" },
    },
    moves: ["e4", "e5", "Nf3", "a6"],
  },
};

export const NoClockNoOpening: Story = {
  args: { mistake: { ...mistakeDetail, clockLeftMs: null, openingName: null, eco: null } },
};

export const MoveListUnavailable: Story = { args: { moves: [] } };

export const MateAgainst: Story = {
  args: { mistake: { ...mistakeDetail, evalAfterCp: -1000, severity: "blunder" } },
};
