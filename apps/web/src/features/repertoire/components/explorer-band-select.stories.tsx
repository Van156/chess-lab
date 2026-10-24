import type { Meta, StoryObj } from "@storybook/react-vite";

import ExplorerBandSelect from "./explorer-band-select";

const meta = {
  title: "App/Repertoire/ExplorerBandSelect",
  component: ExplorerBandSelect,
  tags: ["autodocs"],
  args: { ownBand: 1600, band: 1600, pending: false, onChange: () => {} },
} satisfies Meta<typeof ExplorerBandSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OwnBand: Story = {};

export const OneBandAbove: Story = { args: { band: 1800 } };

export const Saving: Story = { args: { band: 1800, pending: true } };

/** At the top of the list the offsets above the own band repeat it, so they are not listed. */
export const TopOfTheList: Story = { args: { ownBand: 2500, band: 2500 } };

/** At the bottom the lowest bucket is shown as an open range. */
export const BottomOfTheList: Story = { args: { ownBand: 1000, band: 0 } };
