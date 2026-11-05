import type { Meta, StoryObj } from "@storybook/react-vite";

import RepertoireNameField from "./repertoire-name-field";

const meta = {
  title: "App/Repertoire/RepertoireNameField",
  component: RepertoireNameField,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { id: "name", label: "Name", value: "Sicilian", onChange: () => {} },
} satisfies Meta<typeof RepertoireNameField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = { args: { value: "", error: "Enter a name." } };

export const HiddenLabel: Story = { args: { hideLabel: true } };
