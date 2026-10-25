import type { Meta, StoryObj } from "@storybook/react-vite";

import LinePreviewBar from "./line-preview-bar";

const meta = {
  title: "App/Repertoire/LinePreviewBar",
  component: LinePreviewBar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    view: {
      rank: 0,
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      san: "e4",
      lastMove: { from: "e2", to: "e4" },
      nextArrow: { from: "e7", to: "e5" },
      cursor: 1,
      total: 4,
      canPrevious: false,
      canNext: true,
    },
    onPrevious: () => {},
    onNext: () => {},
    onExit: () => {},
  },
} satisfies Meta<typeof LinePreviewBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstMove: Story = {};

export const MidLine: Story = {
  args: {
    view: {
      rank: 2,
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      san: "e5",
      lastMove: { from: "e7", to: "e5" },
      nextArrow: { from: "g1", to: "f3" },
      cursor: 2,
      total: 4,
      canPrevious: true,
      canNext: true,
    },
  },
};

export const EndOfLine: Story = {
  args: {
    view: {
      rank: 4,
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
      san: "Nc6",
      lastMove: { from: "b8", to: "c6" },
      nextArrow: null,
      cursor: 4,
      total: 4,
      canPrevious: true,
      canNext: false,
    },
  },
};
