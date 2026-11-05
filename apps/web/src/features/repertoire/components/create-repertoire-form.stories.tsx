import type { Meta, StoryObj } from "@storybook/react-vite";

import CreateRepertoireForm from "./create-repertoire-form";

const meta = {
  title: "App/Repertoire/CreateRepertoireForm",
  component: CreateRepertoireForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { onCreate: async () => {} },
} satisfies Meta<typeof CreateRepertoireForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
