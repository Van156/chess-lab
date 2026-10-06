import { describe, expect, test } from "bun:test";

import {
  filterNavGroups,
  flattenNavItems,
  getBreadcrumbs,
  type NavGroup,
} from "@/shared/lib/navigation";

import { NO_FEATURES } from "./feature-flags";
import {
  deriveSectionItems,
  getSectionItems,
  pillarEnabled,
  type NavContext,
  adminNavGroup,
  getUserMenuLinks,
  navGroups,
} from "./navigation";

const member: NavContext = { isSuperadmin: false, features: NO_FEATURES };
const superadmin: NavContext = { isSuperadmin: true, features: NO_FEATURES };

describe("getSectionItems", () => {
  test("derives the account tabs from the sidebar config, in order", () => {
    expect(getSectionItems("account", member)).toEqual([
      { to: "/account/profile", label: "Profile" },
      { to: "/account/security", label: "Security" },
      { to: "/account/danger", label: "Danger zone" },
    ]);
  });

  test("derives the admin tabs from the sidebar config, in order", () => {
    expect(getSectionItems("admin", superadmin)).toEqual([
      { to: "/admin/users", label: "Users" },
      { to: "/admin/activity", label: "Activity" },
    ]);
  });

  test("honors the group visibility predicate with the sidebar context", () => {
    expect(getSectionItems("admin", member)).toEqual([]);
  });

  test("every section id in the config is unique", () => {
    const ids = navGroups.map((group) => group.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("navGroups visibility", () => {
  test("a regular user sees Today and account settings but not the platform admin group", () => {
    const labels = filterNavGroups(navGroups, member).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).toEqual(["Today", "Games", "Account settings"]);
  });

  test("the main navigation never contains the admin group, even for a superadmin", () => {
    const groups = filterNavGroups(navGroups, superadmin);
    expect(groups.map((group) => group.id)).toEqual(["chess-lab", "account"]);
    const targets = groups.flatMap((group) => flattenNavItems(group.items).map((item) => item.to));
    expect(targets.some((to) => to.startsWith("/admin"))).toBe(false);
  });

  test("template-only entries stay out of the Chess Lab group", () => {
    const chessLab = navGroups.find((group) => group.id === "chess-lab");
    expect(chessLab?.items.map((item) => item.to)).toEqual([
      "/today",
      "/review",
      "/games",
      "/mistakes",
    ]);
  });

  test("Review and Mistakes follow the mistakes pillar flag; Games is always listed", () => {
    const labels = (features: NavContext["features"]) =>
      filterNavGroups(navGroups, { ...member, features })
        .find((group) => group.id === "chess-lab")
        ?.items.map((item) => item.label);
    expect(labels(NO_FEATURES)).toEqual(["Today", "Games"]);
    expect(labels({ ...NO_FEATURES, mistakes: true })).toEqual([
      "Today",
      "Review",
      "Games",
      "Mistakes",
    ]);
  });

  test("breadcrumbs resolve through the real config", () => {
    expect(getBreadcrumbs(filterNavGroups(navGroups, member), "/account/security")).toEqual([
      { label: "Personal" },
      { label: "Account settings", to: "/account/profile" },
      { label: "Security" },
    ]);
  });
});

describe("admin entry", () => {
  test("the admin group is superadmin only and keeps its pages", () => {
    expect(filterNavGroups([adminNavGroup], member)).toEqual([]);
    const [group] = filterNavGroups([adminNavGroup], superadmin);
    expect(group?.items[0]?.children?.map((child) => child.to)).toEqual([
      "/admin/users",
      "/admin/activity",
    ]);
  });

  test("the user menu offers the admin link to superadmins only", () => {
    expect(getUserMenuLinks(superadmin)).toEqual([{ label: "Platform admin", to: "/admin/users" }]);
    expect(getUserMenuLinks(member)).toEqual([]);
  });

  test("admin breadcrumbs still resolve through the admin group", () => {
    expect(getBreadcrumbs(filterNavGroups([adminNavGroup], superadmin), "/admin/activity")).toEqual(
      [{ label: "Platform" }, { label: "Admin", to: "/admin/users" }, { label: "Activity" }],
    );
  });
});

describe("deriveSectionItems with parents (local fixture)", () => {
  const fixture: NavGroup<NavContext>[] = [
    {
      id: "settings",
      label: "Settings",
      items: [
        {
          label: "Profile",
          to: "/account/profile",
          children: [
            { label: "General", to: "/account/profile" },
            { label: "Secret", to: "/admin/activity", visible: (ctx) => ctx.isSuperadmin },
          ],
        },
        { label: "Preferences", to: "/account/danger" },
      ],
    },
  ];

  test("flattens parents into their visible children", () => {
    expect(deriveSectionItems(fixture, "settings", member)).toEqual([
      { to: "/account/profile", label: "General" },
      { to: "/account/danger", label: "Preferences" },
    ]);
  });

  test("includes children that the context allows", () => {
    expect(deriveSectionItems(fixture, "settings", superadmin).map((item) => item.label)).toEqual([
      "General",
      "Secret",
      "Preferences",
    ]);
  });
});

describe("pillarEnabled", () => {
  const pillarGroup: NavGroup<NavContext>[] = [
    {
      label: "Chess Lab",
      items: [
        { label: "Today", to: "/today" },
        { label: "Blindfold", to: "/account/profile", visible: pillarEnabled("blindfold") },
        { label: "Mistakes", to: "/account/security", visible: pillarEnabled("mistakes") },
      ],
    },
  ];
  const labels = (ctx: NavContext) =>
    filterNavGroups(pillarGroup, ctx).flatMap((group) => group.items.map((item) => item.label));

  test("hides a pillar item while its flag is off", () => {
    expect(labels({ isSuperadmin: false, features: { ...NO_FEATURES, mistakes: true } })).toEqual([
      "Today",
      "Mistakes",
    ]);
  });

  test("shows the item once its flag is on and keeps the rest", () => {
    expect(labels({ isSuperadmin: false, features: { ...NO_FEATURES, blindfold: true } })).toEqual([
      "Today",
      "Blindfold",
    ]);
  });

  test("shows only the always-on entries before the server answers", () => {
    expect(labels(member)).toEqual(["Today"]);
  });
});
