import type { Meta, StoryObj } from "@storybook/react-vite";

import type { QueueItem } from "../lib/review-types";
import ReviewSession from "./review-session";

const card: QueueItem = {
  cardId: "c1",
  pillar: "mistakes",
  state: 2,
  due: new Date("2026-10-04T10:00:00Z"),
  prompt: {
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    orientation: "black",
  },
  answers: [{ san: "Nf6", uci: "g8f6" }],
  context: { playedSan: "h6", gameId: "g1", evalLossCp: 180, ply: 6 },
};

const meta = {
  title: "App/Review/ReviewSession",
  component: ReviewSession,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    phase: "card",
    card,
    progress: { done: 4, total: 12 },
    summary: { cards: 0, answers: 0, byGrade: { 1: 0, 2: 0, 3: 0, 4: 0 }, durationMs: 0 },
    onGrade: () => {},
    onRetryPage: () => {},
    doneAction: <a href="/today">Back to Today</a>,
  },
} satisfies Meta<typeof ReviewSession>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Prompt: Story = {};

export const WaitingForMoreCards: Story = { args: { phase: "waiting", card: null } };

export const PagingFailed: Story = { args: { phase: "failed", card: null } };

export const Complete: Story = {
  args: {
    phase: "done",
    card: null,
    progress: { done: 12, total: 12 },
    summary: { cards: 11, answers: 12, byGrade: { 1: 1, 2: 2, 3: 7, 4: 2 }, durationMs: 412_000 },
  },
};

export const NothingDue: Story = { args: { phase: "done", card: null } };
