import type { Meta, StoryObj } from "@storybook/react-vite";

import { useEffect } from "react";

import { withRouter } from "@/shared/storybook/with-router";

import { useDrillPlayer } from "../hooks/use-drill-player";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import type { DrillKind } from "../lib/questions";
import { askingSession, feedbackSession, MID_RUN_RESULTS } from "./drill-player.fixtures";
import DrillPlayer from "./drill-player";

const labelOf = (kind: DrillKind) =>
  DRILL_CATALOG.find((drill) => drill.kind === kind)?.label ?? kind;

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
    // Stories hold still on feedback; the app moves on after a right speed-drill answer.
    autoAdvanceMs: null,
    onAnswer: () => {},
    onNext: () => {},
    onQuit: () => {},
  },
} satisfies Meta<typeof DrillPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

const asking = (kind: DrillKind): Story => ({
  args: { label: labelOf(kind), session: askingSession(kind) },
});
const wrong = (kind: DrillKind): Story => ({
  args: { label: labelOf(kind), session: feedbackSession(kind) },
});
const right = (kind: DrillKind): Story => ({
  args: { label: labelOf(kind), session: feedbackSession(kind, { correct: true }) },
});
const mobile = { viewport: { defaultViewport: "mobile1" } };

export const SquareColour: Story = asking("square_colour");
export const SquareColourCorrect: Story = right("square_colour");
export const SquareColourWrong: Story = wrong("square_colour");

export const Coordinates: Story = asking("coordinates");
export const CoordinatesCorrect: Story = right("coordinates");
export const CoordinatesWrong: Story = wrong("coordinates");

export const Diagonals: Story = asking("diagonals");
export const DiagonalsCorrect: Story = right("diagonals");
export const DiagonalsWrong: Story = wrong("diagonals");

export const KnightDistance: Story = asking("knight_distance");
export const KnightDistanceCorrect: Story = right("knight_distance");
export const KnightDistanceWrong: Story = wrong("knight_distance");

export const SameDiagonal: Story = asking("same_diagonal");
export const SameDiagonalWrong: Story = wrong("same_diagonal");

export const CheckDetection: Story = asking("check_detection");
export const CheckDetectionWrong: Story = wrong("check_detection");

export const PositionRecall: Story = asking("position_recall");
export const PositionRecallWrong: Story = wrong("position_recall");

export const MateInOne: Story = asking("mate_in_one");
export const MateInOneWrong: Story = wrong("mate_in_one");

/** Ten answered with two misses and a streak of five on show. */
export const MidRunWithStreak: Story = {
  args: {
    label: "Knight distance",
    session: askingSession("knight_distance", MID_RUN_RESULTS),
    elapsedMs: 96_000,
  },
};

/** The last question, where Next reads Finish. */
export const LastQuestion: Story = {
  args: {
    label: "Square colour",
    session: (() => {
      const session = feedbackSession("square_colour", { correct: true });
      const last = session.questions.length - 1;
      return {
        ...session,
        index: last,
        results: Array.from({ length: last + 1 }, (_, index) => index % 6 !== 4),
      };
    })(),
  },
};

export const MobileSquareColour: Story = { ...SquareColour, parameters: mobile };
export const MobileCoordinates: Story = { ...Coordinates, parameters: mobile };
export const MobileKnightDistanceWrong: Story = { ...KnightDistanceWrong, parameters: mobile };
export const MobileDiagonalsWrong: Story = { ...DiagonalsWrong, parameters: mobile };

/** A live session on the real hook: answer with the keyboard, watch the pips, streak and clock. */
function PlayableDrill({ kind }: { kind: DrillKind }) {
  const player = useDrillPlayer();
  const { session, start } = player;
  useEffect(() => {
    if (!session || session.phase === "finished") start(kind, 1);
  }, [session, start, kind]);
  if (!session || session.phase === "finished") return null;
  return (
    <DrillPlayer
      label={labelOf(kind)}
      session={session}
      elapsedMs={player.elapsed}
      onAnswer={player.answer}
      onNext={player.next}
      onQuit={player.quit}
    />
  );
}

export const PlayableSquareColour: Story = {
  render: () => <PlayableDrill kind="square_colour" />,
};

export const PlayableKnightDistance: Story = {
  render: () => <PlayableDrill kind="knight_distance" />,
};
