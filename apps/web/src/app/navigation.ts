import { House, ShieldCheck, UserRound } from "lucide-react";

import type { FeatureFlags, PillarFlag } from "@/app/feature-flags";
import type { SectionNavItem } from "@/shared/components/layout/section-nav";
import { filterNavGroups, flattenNavItems, type NavGroup } from "@/shared/lib/navigation";

/** Inputs to the sidebar items' `visible` predicates. */
export type NavContext = {
  isSuperadmin: boolean;
  /** Server-owned flags (ADR-17); every flag is off until the server answers. */
  features: FeatureFlags;
};

/** `visible` predicate for a pillar item: shown only while its flag is on (ADR-17). */
export function pillarEnabled(pillar: PillarFlag) {
  return (ctx: NavContext) => ctx.features[pillar];
}

/**
 * Sidebar navigation for the authenticated shell. Visibility is UX only: the
 * admin layout keeps its own superadmin check and every platform procedure
 * re-checks on the server (R6.5).
 *
 * Chess Lab entries are added together with their routes (Review in S8, then the pillars with
 * `visible: pillarEnabled(...)`), so the sidebar never links to a route that does not exist yet.
 */
export const navGroups: NavGroup<NavContext>[] = [
  {
    id: "chess-lab",
    label: "Chess Lab",
    items: [{ label: "Today", to: "/today", icon: House }],
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
