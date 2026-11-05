import type { Meta, StoryObj } from "@storybook/react-vite";

import type { MoveRank } from "../lib/continuation-ranking";
import { buildVariationTree } from "../lib/variation-tree";
import { forkGraph, forkGraphPath } from "./repertoire.fixtures";
import VariationTree from "./variation-tree";

const pathOf = (ids: readonly string[]) =>
  ids.flatMap((id) => forkGraph.moves.filter((move) => move.id === id));

const meta = {
  title: "App/Repertoire/VariationTree",
  component: VariationTree,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    tree: buildVariationTree(forkGraph, pathOf(forkGraphPath)),
    fullTree: null,
    onSelect: () => {},
    onDelete: () => {},
    onRename: () => {},
  },
} satisfies Meta<typeof VariationTree>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A fork at the start, a fork at 1... e5 and a nested one at 2. Nf3, with the transposition 2. e4. */
export const ForkNestedAndTransposition: Story = {};

export const AtStart: Story = {
  args: { tree: buildVariationTree(forkGraph, []) },
};

export const Empty: Story = {
  args: { tree: buildVariationTree({ startPositionId: "p0", moves: [] }, []) },
};

/** Rooted at the base 1. e4 e5: only what follows it, with the full repertoire under a fold. */
export const RootedAtBase: Story = {
  args: {
    tree: buildVariationTree(forkGraph, pathOf(["f1", "f2", "f4"]), pathOf(["f1", "f2"])),
    fullTree: buildVariationTree(forkGraph, pathOf(["f1", "f2", "f4"])),
  },
};

/** A base with nothing played after it yet. */
export const NothingAfterBase: Story = {
  args: {
    tree: buildVariationTree({ startPositionId: "p0", moves: [] }, []),
    fullTree: buildVariationTree(forkGraph, []),
  },
};

const named = (name: string) => ({
  ...forkGraph,
  moves: forkGraph.moves.map((move) => (move.id === "f1" ? { ...move, name } : move)),
});

/** A named line and an unnamed one; the line being shown is marked. */
export const NamedAndUnnamedLines: Story = {
  args: { tree: buildVariationTree(named("King's pawn"), pathOf(forkGraphPath)) },
};

/** The line being shown is the second group, so the first is not marked. */
export const CurrentLineIsSecond: Story = {
  args: { tree: buildVariationTree(named("King's pawn"), pathOf(["f7", "f8"])) },
};

/** The fold open: it lists the whole repertoire as a plain outline, with no second current move. */
export const FoldOpen: Story = {
  args: { ...RootedAtBase.args, foldOpenByDefault: true },
};

const ranked = (rank: number, scoreLabel: string): MoveRank => ({
  rank,
  of: 2,
  score: { kind: "cp", value: 0 },
  scoreLabel,
});

/** Engine ranking: 1. Nf3 is listed before 1. e4, and 1... c5 before 1... e5 in the fork. */
export const WithEngineRanks: Story = {
  args: {
    tree: buildVariationTree(forkGraph, pathOf(["f1", "f2"])),
    rankings: new Map([
      ["f7", ranked(1, "+0.30")],
      ["f1", ranked(2, "+0.20")],
      ["f3", ranked(1, "-0.10")],
      ["f2", ranked(2, "-0.40")],
    ]),
  },
};

const graded = (rank: number, of: number, scoreLabel: string): MoveRank => ({
  rank,
  of,
  score: { kind: "cp", value: 10 },
  scoreLabel,
  engineBest: { san: "Bc4", scoreLabel: "+0.40" },
});

/** A single stored move graded against the engine: 1. e4 is #2 of 4 and the engine prefers Bc4. */
export const GradedSingleMove: Story = {
  args: {
    tree: buildVariationTree({ startPositionId: "p0", moves: forkGraph.moves.slice(0, 2) }, []),
    rankings: new Map([["f1", graded(2, 4, "+0.10")]]),
  },
};

/** Two moves graded in one field: both ranked among the engine's top moves, one hint for the position. */
export const GradedTwoMoves: Story = {
  args: {
    tree: buildVariationTree(forkGraph, pathOf(["f1", "f2"])),
    rankings: new Map([
      ["f7", graded(2, 4, "+0.30")],
      ["f1", graded(3, 4, "+0.20")],
    ]),
  },
};
