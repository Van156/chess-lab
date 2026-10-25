import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { askingSession, feedbackSession } from "./drill-player.fixtures";
import DrillPlayer from "./drill-player";

const meta = {
  title: "App/Blindfold/DrillPlayer",
  component: DrillPlayer,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    label: "Square colour",
    session: askingSession("square_colour"),
    elapsedMs: 42_000,
    onAnswer: () => {},
    onNext: () => {},
    onQuit: () => {},
  },
} satisfies Meta<typeof DrillPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SquareColour: Story = {};

export const Coordinates: Story = {
  args: { label: "Coordinates", session: askingSession("coordinates") },
};

export const Diagonals: Story = {
  args: { label: "Diagonals", session: askingSession("diagonals") },
};

export const KnightDistance: Story = {
  args: { label: "Knight distance", session: askingSession("knight_distance") },
};

export const WrongAnswerFeedback: Story = {
  args: { session: feedbackSession("square_colour") },
};
