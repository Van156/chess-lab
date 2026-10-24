import type { Meta, StoryObj } from "@storybook/react-vite";

import ExplorerBandSelect from "./explorer-band-select";

const meta = {
  title: "App/Repertoire/ExplorerBandSelect",
  component: ExplorerBandSelect,
  tags: ["autodocs"],
  args: { ownBand: 1600, offset: 0, pending: false, onChange: () => {} },
} satisfies Meta<typeof ExplorerBandSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OwnBand: Story = {};

export const OneBandAbove: Story = { args: { offset: 1 } };

export const Saving: Story = { args: { offset: 1, pending: true } };

/** At the top of the list the offsets above the own band repeat it, so they are not listed. */
export const TopOfTheList: Story = { args: { ownBand: 2500, offset: 0 } };

/** At the bottom the lowest bucket is shown as an open range. */
export const BottomOfTheList: Story = { args: { ownBand: 1000, offset: -1 } };

/** The saved offset is clamped to the top band; it stays listed so the user can reset it. */
export const ClampedSavedOffset: Story = { args: { ownBand: 2500, offset: 2 } };
