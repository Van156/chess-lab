import { LayoutDashboardIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";

import SidebarUserMenu from "@/shared/components/layout/sidebar-user-menu";
import type { NavGroup } from "@/shared/lib/navigation";

/** Deterministic fixtures shared by the AppSidebar and AppShell stories. */
export type FixtureNavContext = { isSuperadmin: boolean };

export const fixtureGroups: NavGroup<FixtureNavContext>[] = [
  {
    label: "Dashboard",
    items: [{ label: "Dashboard", to: "/today", icon: LayoutDashboardIcon }],
  },
  {
    label: "Personal",
    items: [
      {
        label: "Account settings",
        to: "/account/profile",
        icon: UserRoundIcon,
        children: [
          { label: "Profile", to: "/account/profile" },
          { label: "Security", to: "/account/security" },
        ],
      },
    ],
  },
  {
    label: "Platform",
    visible: (ctx) => ctx.isSuperadmin,
    items: [
      {
        label: "Admin",
        to: "/admin/users",
        icon: ShieldCheckIcon,
        children: [
          { label: "Users", to: "/admin/users" },
          { label: "Activity", to: "/admin/activity" },
        ],
      },
    ],
  },
];

const noop = () => {};

export const fixtureFooter = (
  <SidebarUserMenu user={{ name: "Ada Lovelace", email: "ada@example.com" }} onSignOut={noop} />
);
