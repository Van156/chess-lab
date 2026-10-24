import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import {
  afterE4,
  afterE5,
  c5Move,
  centreNote,
  e4Move,
  e5Move,
  emptyNote,
  explorerOk,
  startPosition,
  whiteRepertoire,
  blackRepertoire,
} from "./repertoire.fixtures";
import RepertoireBuilderView from "./repertoire-builder-view";

const meta = {
  title: "App/Repertoire/RepertoireBuilderView",
  component: RepertoireBuilderView,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    repertoire: whiteRepertoire,
    position: afterE4,
    path: [e4Move],
    childMoves: [e5Move, c5Move],
    explorer: { kind: "loaded", data: explorerOk },
    note: emptyNote,
    noteDirty: false,
    saving: false,
    bandSaving: false,
    onPlayMove: () => {},
    onChangeBandOffset: () => {},
    onSelectPly: () => {},
    onSelectChild: () => {},
    onRequestDelete: () => {},
    onNoteChange: () => {},
    onSaveNote: () => {},
    onClearNote: () => {},
  },
} satisfies Meta<typeof RepertoireBuilderView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidLine: Story = {};

export const StartPosition: Story = {
  args: { position: startPosition, path: [], childMoves: [e4Move] },
};

export const WithIdeaNote: Story = {
  args: {
    position: afterE5,
    path: [e4Move, e5Move],
    childMoves: [],
    note: centreNote,
    noteDirty: true,
  },
};

export const PlayingBlack: Story = {
  args: { repertoire: blackRepertoire, position: startPosition, path: [], childMoves: [e4Move] },
};

export const ExplorerUnavailable: Story = { args: { explorer: { kind: "failed" } } };
