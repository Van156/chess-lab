import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { whiteRepertoire } from "./repertoire.fixtures";
import RepertoireRow from "./repertoire-row";

const meta = {
  title: "App/Repertoire/RepertoireRow",
  component: RepertoireRow,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    repertoire: whiteRepertoire,
    onRename: async () => {},
    onDelete: async () => {},
  },
} satisfies Meta<typeof RepertoireRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongName: Story = {
  args: {
    repertoire: {
      ...whiteRepertoire,
      name: "A very long repertoire name that has to wrap on a 375 pixel wide screen without overflow",
    },
  },
};
