import { Button } from "@b2c-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { ExtraQuestion } from "../../lib/drills/types";
import {
  CHECK_NO,
  CHECK_YES,
  MATE_BACK_RANK,
  MATE_BLACK_TO_MOVE,
  RECALL_EMPTY,
  RECALL_PIECE,
  SAME_DIAGONAL_NO,
  SAME_DIAGONAL_SAME_COLOUR,
  SAME_DIAGONAL_YES,
  promptFor,
} from "./answers.fixtures";
import { ExtraDrillAnswer, ExtraDrillStimulus } from "./index";

/** Stimulus and answer controls stacked the way the drill player hosts them. */
function DrillPreview({ question, revealed }: { question: ExtraQuestion; revealed: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <p className="text-xl font-medium tracking-tight">{promptFor(question)}</p>
      <ExtraDrillStimulus question={question} revealed={revealed} />
      {revealed ? (
        <div className="flex flex-col items-start gap-3">
          <p role="status" className="text-success">
            Correct.
          </p>
          <Button type="button">Next</Button>
        </div>
      ) : (
        <ExtraDrillAnswer question={question} onSubmit={() => {}} />
      )}
    </div>
  );
}

const meta = {
  title: "App/Blindfold/Answers",
  component: DrillPreview,
  parameters: { layout: "padded" },
  args: { question: SAME_DIAGONAL_YES, revealed: false },
} satisfies Meta<typeof DrillPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SameDiagonal: Story = {};
export const SameDiagonalRevealed: Story = { args: { revealed: true } };
export const SameDiagonalNoRevealed: Story = {
  args: { question: SAME_DIAGONAL_NO, revealed: true },
};
export const SameDiagonalSameColourRevealed: Story = {
  args: { question: SAME_DIAGONAL_SAME_COLOUR, revealed: true },
};

export const CheckDetection: Story = { args: { question: CHECK_YES } };
export const CheckDetectionRevealed: Story = { args: { question: CHECK_YES, revealed: true } };
export const CheckDetectionNoCheckRevealed: Story = {
  args: { question: CHECK_NO, revealed: true },
};

export const PositionRecall: Story = { args: { question: RECALL_PIECE } };
export const PositionRecallRevealed: Story = { args: { question: RECALL_PIECE, revealed: true } };
export const PositionRecallEmptyRevealed: Story = {
  args: { question: RECALL_EMPTY, revealed: true },
};

export const MateInOne: Story = { args: { question: MATE_BACK_RANK } };
export const MateInOneRevealed: Story = { args: { question: MATE_BACK_RANK, revealed: true } };
export const MateInOneBlackToMove: Story = { args: { question: MATE_BLACK_TO_MOVE } };
