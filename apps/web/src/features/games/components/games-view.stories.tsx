import type { Meta, StoryObj } from "@storybook/react-vite";
import { SyncStatus } from "@/features/today";

import { withRouter } from "@/shared/storybook/with-router";

import type { GameItem } from "../lib/games-types";
import GamesView from "./games-view";

const base: GameItem = {
  id: "g1",
  lichessGameId: "abcd1234",
  userColor: "white",
  speed: "blitz",
  rated: true,
  result: "1-0",
  eco: "C50",
  openingName: "Italian Game",
  playedAt: new Date("2026-10-04T18:20:00Z"),
  importedAt: new Date("2026-10-05T08:00:00Z"),
  analysisStatus: "complete",
};

const games: GameItem[] = [
  base,
  { ...base, id: "g2", userColor: "black", result: "1-0", analysisStatus: "confirming" },
  { ...base, id: "g3", result: "1/2-1/2", openingName: null, analysisStatus: "pending" },
  { ...base, id: "g4", speed: "rapid", rated: false, analysisStatus: "failed" },
];

const idle = {
  tone: "neutral",
  message: "Last synced 12 min ago",
  canSync: true,
} as const;

const meta = {
  title: "App/Games/GamesView",
  component: GamesView,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    games,
    importedCount: 84,
    hasMore: true,
    loadingMore: false,
    onLoadMore: () => {},
    showMistakesLink: true,
    sync: <SyncStatus description={idle} onSyncNow={() => {}} />,
  },
} satisfies Meta<typeof GamesView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithGames: Story = {};

export const LoadingMore: Story = { args: { loadingMore: true } };

export const LastPage: Story = { args: { hasMore: false } };

export const Empty: Story = { args: { games: [], hasMore: false, importedCount: 0 } };

export const SyncRunning: Story = {
  args: {
    sync: (
      <SyncStatus
        description={{ tone: "progress", message: "Syncing your Lichess games", canSync: false }}
        onSyncNow={() => {}}
      />
    ),
  },
};

export const SyncBackoff: Story = {
  args: {
    sync: (
      <SyncStatus
        description={{
          tone: "warning",
          message: "Lichess asked us to slow down. Retrying in 4 min.",
          canSync: false,
        }}
        onSyncNow={() => {}}
      />
    ),
  },
};

export const SyncFailed: Story = {
  args: {
    sync: (
      <SyncStatus
        description={{
          tone: "error",
          message: "The last sync failed. Use Sync now to try again.",
          canSync: true,
        }}
        onSyncNow={() => {}}
      />
    ),
  },
};
