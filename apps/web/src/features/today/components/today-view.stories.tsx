import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { SyncStatus } from "../lib/today-types";
import StartReviewButton from "./start-review-button";
import TodayView from "./today-view";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const synced: SyncStatus = {
  state: "idle",
  lastSyncedAt: new Date(NOW - 12 * 60_000),
  retryAt: null,
  gamesImported: 84,
};

const meta = {
  title: "App/Today/TodayView",
  component: TodayView,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    now: NOW,
    onSyncNow: () => {},
    reviewAction: <StartReviewButton to="/today" />,
    summary: {
      due: { mistakes: 12 },
      dueTotal: 12,
      newBudgetLeft: 5,
      streak: { days: 6, reviewedToday: false },
      sync: synced,
    },
  },
} satisfies Meta<typeof TodayView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CardsDue: Story = {};

export const ReviewUnavailable: Story = {
  args: { reviewAction: <StartReviewButton /> },
};

export const CaughtUp: Story = {
  args: {
    summary: {
      due: {},
      dueTotal: 0,
      newBudgetLeft: 0,
      streak: { days: 7, reviewedToday: true },
      sync: synced,
    },
  },
};

export const NoGamesYet: Story = {
  args: {
    summary: {
      due: {},
      dueTotal: 0,
      newBudgetLeft: 0,
      streak: { days: 0, reviewedToday: false },
      sync: { state: "idle", lastSyncedAt: null, retryAt: null, gamesImported: 0 },
    },
  },
};

export const Syncing: Story = {
  args: {
    summary: {
      due: { mistakes: 12 },
      dueTotal: 12,
      newBudgetLeft: 5,
      streak: { days: 6, reviewedToday: true },
      sync: { ...synced, state: "running" },
    },
  },
};

export const SyncBackoff: Story = {
  args: {
    summary: {
      due: { mistakes: 12 },
      dueTotal: 12,
      newBudgetLeft: 5,
      streak: { days: 6, reviewedToday: true },
      sync: { ...synced, state: "backoff", retryAt: new Date(NOW + 4 * 60_000) },
    },
  },
};

export const SyncFailed: Story = {
  args: {
    summary: {
      due: { mistakes: 12 },
      dueTotal: 12,
      newBudgetLeft: 5,
      streak: { days: 6, reviewedToday: true },
      sync: { ...synced, state: "failed" },
    },
  },
};
