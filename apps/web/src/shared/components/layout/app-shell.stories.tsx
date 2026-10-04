import { Button } from "@b2c-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  fixtureFooter,
  fixtureGroups,
  type FixtureNavContext,
} from "@/shared/storybook/app-shell-fixtures";
import { withRouter } from "@/shared/storybook/with-router";

import AppBreadcrumbs from "./app-breadcrumbs";
import AppShell from "./app-shell";
import PageHeader from "./page-header";

const meta = {
  title: "App/Layout/AppShell",
  component: AppShell<FixtureNavContext>,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 560 } },
  },
  decorators: [withRouter],
  args: {
    navGroups: fixtureGroups,
    navContext: { isSuperadmin: true },
    sidebarFooter: fixtureFooter,
    breadcrumb: (
      <AppBreadcrumbs
        items={[
          { label: "Personal" },
          { label: "Account settings", to: "/account/profile" },
          { label: "Security" },
        ]}
      />
    ),
    headerActions: (
      <Button size="sm" variant="outline">
        Theme
      </Button>
    ),
    children: <PageHeader title="Security" description="Manage your password and sessions." />,
  },
} satisfies Meta<typeof AppShell<FixtureNavContext>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

export const IconCollapsed: Story = {
  args: { defaultSidebarOpen: false },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
