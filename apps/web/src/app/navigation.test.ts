import { describe, expect, test } from "bun:test";

import { filterNavGroups, getBreadcrumbs, type NavGroup } from "@/shared/lib/navigation";

import { deriveSectionItems, getSectionItems, type NavContext, navGroups } from "./navigation";

const member: NavContext = { isSuperadmin: false };
const superadmin: NavContext = { isSuperadmin: true };

describe("getSectionItems", () => {
  test("derives the account tabs from the sidebar config, in order", () => {
    expect(getSectionItems("account", member)).toEqual([
      { to: "/account/profile", label: "Profile" },
      { to: "/account/security", label: "Security" },
      { to: "/account/preferences", label: "Preferences" },
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
  test("a regular user sees dashboard and account settings but not the platform admin group", () => {
    const labels = filterNavGroups(navGroups, member).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).toEqual(["Dashboard", "Account settings"]);
  });

  test("a superadmin additionally sees the admin parent with its children", () => {
    const groups = filterNavGroups(navGroups, superadmin);
    expect(groups.map((group) => group.id)).toEqual([undefined, "account", "admin"]);
    const admin = groups.find((group) => group.id === "admin");
    expect(admin?.items[0]?.children?.map((child) => child.to)).toEqual([
      "/admin/users",
      "/admin/activity",
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
        { label: "Preferences", to: "/account/preferences" },
      ],
    },
  ];

  test("flattens parents into their visible children", () => {
    expect(deriveSectionItems(fixture, "settings", member)).toEqual([
      { to: "/account/profile", label: "General" },
      { to: "/account/preferences", label: "Preferences" },
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
