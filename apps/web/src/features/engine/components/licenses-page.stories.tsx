import type { Meta, StoryObj } from "@storybook/react-vite";

import LicensesPage from "./licenses-page";

const meta = {
  title: "App/Engine/LicensesPage",
  component: LicensesPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LicensesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
