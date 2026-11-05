import type { Meta, StoryObj } from "@storybook/react-vite";

import SyncStatus from "./sync-status";

const meta = {
  title: "App/Today/SyncStatus",
  component: SyncStatus,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    onSyncNow: () => {},
    description: { tone: "neutral", message: "Last synced 12 min ago", canSync: true },
  },
} satisfies Meta<typeof SyncStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Running: Story = {
  args: {
    description: { tone: "progress", message: "Syncing your Lichess games", canSync: false },
  },
};

export const Backoff: Story = {
  args: {
    description: {
      tone: "warning",
      message: "Lichess asked us to slow down. Retrying in 4 min.",
      canSync: false,
    },
  },
};

export const Failed: Story = {
  args: {
    description: {
      tone: "error",
      message: "The last sync failed. Use Sync now to try again.",
      canSync: true,
    },
  },
};

export const RequestPending: Story = { args: { pending: true } };
