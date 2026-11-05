import type { Meta, StoryObj } from "@storybook/react-vite";

import type { QueueItem } from "../lib/review-types";
import ReviewCardView from "./review-card-view";

const card: QueueItem = {
  cardId: "c1",
  pillar: "mistakes",
  state: 3,
  due: new Date("2026-10-04T10:00:00Z"),
  prompt: {
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    orientation: "black",
  },
  answers: [{ san: "Nf6", uci: "g8f6" }],
  context: { playedSan: "h6", gameId: "g1", evalLossCp: 180, ply: 6 },
};

const meta = {
  title: "App/Review/ReviewCardView",
  component: ReviewCardView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    card,
    attempt: null,
    revealed: false,
    onMove: () => {},
    onReveal: () => {},
    onGrade: () => {},
  },
} satisfies Meta<typeof ReviewCardView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Prompt: Story = {};

export const MoveEntered: Story = { args: { attempt: { san: "d6", correct: false } } };

export const RevealedCorrect: Story = {
  args: { revealed: true, attempt: { san: "Nf6", correct: true, from: "g8", to: "f6" } },
};

export const RevealedWrong: Story = {
  args: { revealed: true, attempt: { san: "d6", correct: false } },
};

export const RevealedWithoutMove: Story = { args: { revealed: true } };
