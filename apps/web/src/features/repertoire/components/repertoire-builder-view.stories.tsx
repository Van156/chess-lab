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
  midLineArrowText,
  midLineArrows,
  openGameE5Tree,
  openGameStartTree,
  openGameTree,
  engineOffView,
  engineOnView,
  explorerOk,
  midLinePreview,
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
    tree: openGameTree,
    startPositionId: "p0",
    opening: { eco: "B00", name: "King's Pawn Game" },
    explorer: { kind: "loaded", data: explorerOk },
    engine: engineOnView,
    boardArrows: midLineArrows,
    boardArrowText: midLineArrowText,
    lineCount: 3,
    preview: null,
    showRepertoireArrows: true,
    note: emptyNote,
    noteDirty: false,
    saving: false,
    bandSaving: false,
    onPlayMove: () => {},
    onChangeBandOffset: () => {},
    onToggleEngine: () => {},
    onRetryEngine: () => {},
    onPreviewLine: () => {},
    onPreviewPrevious: () => {},
    onPreviewNext: () => {},
    onPreviewExit: () => {},
    onSelectPly: () => {},
    onChangeLineCount: () => {},
    onToggleRepertoireArrows: () => {},
    onSelectNode: () => {},
    onDeleteNode: () => {},
    onRequestDelete: () => {},
    onNoteChange: () => {},
    onSaveNote: () => {},
    onClearNote: () => {},
  },
} satisfies Meta<typeof RepertoireBuilderView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidLine: Story = {};

export const PreviewingALine: Story = { args: { preview: midLinePreview } };

export const StartPosition: Story = {
  args: {
    opening: null,
    position: startPosition,
    path: [],
    childMoves: [e4Move],
    tree: openGameStartTree,
  },
};

export const WithIdeaNote: Story = {
  args: {
    position: afterE5,
    path: [e4Move, e5Move],
    childMoves: [],
    tree: openGameE5Tree,
    note: centreNote,
    noteDirty: true,
  },
};

export const PlayingBlack: Story = {
  args: {
    repertoire: blackRepertoire,
    position: startPosition,
    path: [],
    childMoves: [e4Move],
    tree: openGameStartTree,
  },
};

export const ExplorerUnavailable: Story = { args: { explorer: { kind: "failed" } } };

export const EngineOff: Story = { args: { engine: engineOffView } };

export const EngineAnalysing: Story = {
  args: {
    engine: {
      panel: {
        kind: "analysing",
        depth: 9,
        maxDepth: 18,
        lines: engineOnView.panel.kind === "done" ? engineOnView.panel.lines : [],
      },
      whitePercent: 52,
    },
  },
};

export const OneEngineLine: Story = {
  args: {
    lineCount: 1,
    boardArrows: midLineArrows.slice(-3),
    boardArrowText: "Engine lines, best first: 1 e4 (blue).",
  },
};

export const RepertoireArrowsOff: Story = {
  args: {
    showRepertoireArrows: false,
    boardArrowText: "Engine lines, best first: 1 e4 (blue), 2 d4 (violet), 3 Nf3 (pink).",
  },
};

export const EngineUnavailable: Story = {
  args: { engine: { panel: { kind: "unavailable" }, whitePercent: null } },
};

export const EngineWithIdeaNote: Story = {
  args: {
    position: startPosition,
    path: [],
    childMoves: [e4Move],
    tree: openGameStartTree,
    note: centreNote,
  },
};

export const OpeningNamed: Story = {
  args: {
    opening: { eco: "C44", name: "Scotch Game" },
    position: afterE5,
    path: [e4Move, e5Move],
    childMoves: [],
    tree: openGameE5Tree,
  },
};
