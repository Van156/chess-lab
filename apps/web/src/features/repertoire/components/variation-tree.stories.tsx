import type { Meta, StoryObj } from "@storybook/react-vite";

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
