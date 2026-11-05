// STUB: replaced by the answer controls for the drills in `lib/drills/*`.
import type { ExtraQuestion } from "../../lib/drills/types";
import type { Answer } from "../../lib/questions";

export type ExtraAnswerProps = { question: ExtraQuestion; onSubmit: (answer: Answer) => void };

/** Answer controls for the drills implemented in `lib/drills/*`. */
export function ExtraDrillAnswer(_props: ExtraAnswerProps) {
  return null;
}

export type ExtraStimulusProps = {
  question: ExtraQuestion;
  /** True once the question is answered: the stimulus may reveal the solution. */
  revealed: boolean;
};

/** What the player reads or sees before answering (piece list, move list…), for those drills. */
export function ExtraDrillStimulus(_props: ExtraStimulusProps) {
  return null;
}
