import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { blackRepertoire, whiteRepertoire } from "./repertoire.fixtures";
import RepertoireListView from "./repertoire-list-view";

const meta = {
  title: "App/Repertoire/RepertoireListView",
  component: RepertoireListView,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    repertoires: [whiteRepertoire, blackRepertoire],
    onCreate: async () => {},
    onRename: async () => {},
    onDelete: async () => {},
  },
} satisfies Meta<typeof RepertoireListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRepertoires: Story = {};

export const OneColourOnly: Story = { args: { repertoires: [whiteRepertoire] } };

export const Empty: Story = { args: { repertoires: [] } };
