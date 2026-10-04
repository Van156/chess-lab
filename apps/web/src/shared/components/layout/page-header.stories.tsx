import { Button } from "@b2c-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import PageHeader from "./page-header";

const meta = {
  title: "App/Layout/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  // Breadcrumb links render TanStack `Link`, which needs a router context.
  decorators: [withRouter],
  args: { title: "Security" },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescriptionAndActions: Story = {
  args: {
    description: "Manage your password and active sessions.",
    actions: <Button size="sm">Sign out everywhere</Button>,
  },
};

export const WithBreadcrumbs: Story = {
  args: {
    breadcrumbs: [{ label: "Account settings", to: "/" }, { label: "Security" }],
  },
};
