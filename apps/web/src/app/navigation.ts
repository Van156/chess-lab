import {
  BookMarked,
  BookOpenCheck,
  Crosshair,
  EyeOff,
  History,
  House,
  ShieldCheck,
  UserRound,
} from "lucide-react";

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
 * The admin group is not part of this list; see `adminNavGroup`.
 *
 * Chess Lab entries are added together with their routes (Review shipped in S8, Games and Mistakes in S10, Repertoire in P2-b, Blindfold with its route; the other pillars
 * follow with `visible: pillarEnabled(...)`), so the sidebar never links to a route that does not exist yet.
 */
export const navGroups: NavGroup<NavContext>[] = [
  {
    id: "chess-lab",
    label: "Chess Lab",
    items: [
      { label: "Today", to: "/today", icon: House },
      { label: "Review", to: "/review", icon: BookOpenCheck, visible: pillarEnabled("mistakes") },
      { label: "Games", to: "/games", icon: History },
      { label: "Mistakes", to: "/mistakes", icon: Crosshair, visible: pillarEnabled("mistakes") },
      {
        label: "Repertoire",
        to: "/repertoire",
        icon: BookMarked,
        visible: pillarEnabled("repertoire"),
      },
      { label: "Blindfold", to: "/blindfold", icon: EyeOff, visible: pillarEnabled("blindfold") },
    ],
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
          { label: "Danger zone", to: "/account/danger" },
        ],
      },
    ],
  },
];

/**
 * Platform admin group (ADR-21). Kept out of the main navigation: it is reached from the user
 * menu (`getUserMenuLinks`) and feeds the admin section tabs and breadcrumbs. Superadmins only.
 */
export const adminNavGroup: NavGroup<NavContext> = {
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
};

/** Every group that resolves breadcrumbs and section tabs: the sidebar plus the admin group. */
export const allNavGroups: NavGroup<NavContext>[] = [...navGroups, adminNavGroup];

/** A link shown in the user menu rather than the sidebar. */
export type UserMenuLink = { label: string; to: "/admin/users" };

/** User-menu links for the context: the admin entry exists for superadmins only (UX; the server re-checks). */
export function getUserMenuLinks(context: NavContext): UserMenuLink[] {
  return context.isSuperadmin ? [{ label: "Platform admin", to: "/admin/users" }] : [];
}

/**
 * Tab items for a section layout (`account`, `admin`), derived from the
 * sidebar config with the same visibility predicates and context, so both
 * navigations always list the same pages.
 */
export function getSectionItems(
  sectionId: "account" | "admin",
  context: NavContext,
): SectionNavItem[] {
  return deriveSectionItems(allNavGroups, sectionId, context);
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
