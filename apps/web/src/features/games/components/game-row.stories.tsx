import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { GameItem } from "../lib/games-types";
import GameRow from "./game-row";

const game: GameItem = {
  id: "g1",
  lichessGameId: "abcd1234",
  userColor: "white",
  speed: "blitz",
  rated: true,
  result: "0-1",
  eco: "B20",
  openingName: "Sicilian Defense",
  playedAt: new Date("2026-10-04T18:20:00Z"),
  importedAt: new Date("2026-10-05T08:00:00Z"),
  analysisStatus: "complete",
};

const meta = {
  title: "App/Games/GameRow",
  component: GameRow,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: { game, showMistakesLink: true },
} satisfies Meta<typeof GameRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Analysed: Story = {};

export const Pending: Story = { args: { game: { ...game, analysisStatus: "pending" } } };

export const Analysing: Story = { args: { game: { ...game, analysisStatus: "screening" } } };

export const Failed: Story = { args: { game: { ...game, analysisStatus: "failed" } } };

export const MistakesPillarOff: Story = { args: { showMistakesLink: false } };

export const NoOpening: Story = { args: { game: { ...game, openingName: null, eco: null } } };
