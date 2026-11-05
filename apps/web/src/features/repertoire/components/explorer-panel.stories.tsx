import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@b2c-template/ui/components/button";

import ExplorerBandSelect from "./explorer-band-select";
import ExplorerPanel from "./explorer-panel";
import {
  e5Move,
  explorerEmpty,
  explorerOk,
  explorerOneBandAbove,
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

const addButton = (disabled: boolean) => (move: { san: string }) => (
  <Button
    type="button"
    variant="outline"
    className="min-h-11"
    disabled={disabled}
    aria-label={`Add ${move.san} to the repertoire`}
  >
    Add
  </Button>
);

const bandSelect = (pending: boolean, offset = 0) => (
  <ExplorerBandSelect ownBand={1600} offset={offset} pending={pending} onChange={() => {}} />
);

export const WithAddAndBandSelect: Story = {
  args: { moveAction: addButton(false), bandControl: bandSelect(false) },
};

export const AddingMove: Story = {
  args: { moveAction: addButton(true), bandControl: bandSelect(false) },
};

export const ChangingBand: Story = {
  args: { moveAction: addButton(false), bandControl: bandSelect(true) },
};

export const BandOneAbove: Story = {
  args: {
    state: { kind: "loaded", data: explorerOneBandAbove },
    moveAction: addButton(false),
    bandControl: bandSelect(false, 1),
  },
};
