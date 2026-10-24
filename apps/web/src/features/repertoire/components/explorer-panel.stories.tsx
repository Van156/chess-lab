import type { Meta, StoryObj } from "@storybook/react-vite";

import ExplorerPanel from "./explorer-panel";
import {
  e5Move,
  explorerEmpty,
  explorerOk,
  explorerStale,
  explorerUnavailable,
} from "./repertoire.fixtures";

const meta = {
  title: "App/Repertoire/ExplorerPanel",
  component: ExplorerPanel,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { state: { kind: "loaded", data: explorerOk }, childMoves: [e5Move] },
} satisfies Meta<typeof ExplorerPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithStats: Story = {};

export const Loading: Story = { args: { state: { kind: "loading" } } };

export const SavedResults: Story = { args: { state: { kind: "loaded", data: explorerStale } } };

export const NoGames: Story = { args: { state: { kind: "loaded", data: explorerEmpty } } };

export const NeedsLichessSignIn: Story = {
  args: { state: { kind: "loaded", data: explorerUnavailable("unauthorized") } },
};

export const LichessBusy: Story = {
  args: { state: { kind: "loaded", data: explorerUnavailable("rate_limited") } },
};

export const LichessTimedOut: Story = {
  args: { state: { kind: "loaded", data: explorerUnavailable("timeout") } },
};

export const LichessError: Story = {
  args: { state: { kind: "loaded", data: explorerUnavailable("error") } },
};

export const RequestFailed: Story = { args: { state: { kind: "failed" } } };
