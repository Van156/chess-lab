import { LayoutDashboard, ShieldCheck, UserRound } from "lucide-react";

import type { SectionNavItem } from "@/shared/components/layout/section-nav";
import { filterNavGroups, flattenNavItems, type NavGroup } from "@/shared/lib/navigation";

/** Inputs to the sidebar items' `visible` predicates. */
export type NavContext = {
  isSuperadmin: boolean;
};

/**
 * Sidebar navigation for the authenticated shell. Visibility is UX only: the
 * admin layout keeps its own superadmin check and every platform procedure
 * re-checks on the server (R6.5).
 */
export const navGroups: NavGroup<NavContext>[] = [
  {
    label: "Dashboard",
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "account",
    label: "Personal",
    items: [
      {
        label: "Account settings",
        to: "/account/profile",
        icon: UserRound,
        children: [
          { label: "Profile", to: "/account/profile" },
          { label: "Security", to: "/account/security" },
          { label: "Preferences", to: "/account/preferences" },
          { label: "Danger zone", to: "/account/danger" },
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "Platform",
    visible: (ctx) => ctx.isSuperadmin,
    items: [
      {
        label: "Admin",
        to: "/admin/users",
        icon: ShieldCheck,
        children: [
          { label: "Users", to: "/admin/users" },
          { label: "Activity", to: "/admin/activity" },
        ],
      },
    ],
  },
];

/**
 * Tab items for a section layout (`account`, `admin`), derived from the
 * sidebar config with the same visibility predicates and context, so both
 * navigations always list the same pages.
 */
export function getSectionItems(
  sectionId: "account" | "admin",
  context: NavContext,
): SectionNavItem[] {
  return deriveSectionItems(navGroups, sectionId, context);
}

/** Pure core of `getSectionItems`, taking the config so tests can use a local fixture. */
export function deriveSectionItems(
  groups: NavGroup<NavContext>[],
  sectionId: string,
  context: NavContext,
): SectionNavItem[] {
  const group = filterNavGroups(groups, context).find((candidate) => candidate.id === sectionId);
  return flattenNavItems(group?.items ?? []).map(({ to, label }) => ({ to, label }));
}
