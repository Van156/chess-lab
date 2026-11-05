import { describe, expect, test } from "bun:test";

import {
  filterNavGroups,
  flattenNavItems,
  getBreadcrumbs,
  isNavItemActive,
  isPathActive,
  type NavGroup,
  type NavItem,
} from "./navigation";

type Ctx = { admin: boolean };

const groups: NavGroup<Ctx>[] = [
  { label: "Main", items: [{ label: "Dashboard", to: "/today" }] },
  {
    label: "Platform",
    items: [
      { label: "Users", to: "/admin/users", visible: (ctx) => ctx.admin },
      { label: "Activity", to: "/admin/activity", visible: (ctx) => ctx.admin },
    ],
  },
  {
    label: "Mixed",
    items: [
      { label: "Always", to: "/account/profile" },
      { label: "Admin only", to: "/admin/activity", visible: (ctx) => ctx.admin },
    ],
  },
  {
    label: "Hidden group",
    visible: (ctx) => ctx.admin,
    items: [{ label: "X", to: "/games" }],
  },
];

describe("filterNavGroups", () => {
  test("keeps items without a predicate and drops those whose predicate is false", () => {
    const result = filterNavGroups(groups, { admin: false });
    expect(result.map((g) => g.label)).toEqual(["Main", "Mixed"]);
    expect(result[1]?.items.map((i) => i.label)).toEqual(["Always"]);
  });

  test("drops a group whose items are all hidden, and honours a group predicate", () => {
    const result = filterNavGroups(groups, { admin: false });
    expect(result.some((g) => g.label === "Platform")).toBe(false);
    expect(result.some((g) => g.label === "Hidden group")).toBe(false);
  });

  test("shows everything when the predicates pass, preserving order", () => {
    const result = filterNavGroups(groups, { admin: true });
    expect(result.map((g) => g.label)).toEqual(["Main", "Platform", "Mixed", "Hidden group"]);
    expect(result[1]?.items.map((i) => i.label)).toEqual(["Users", "Activity"]);
  });

  test("does not mutate the input", () => {
    const before = JSON.stringify(groups.map((g) => g.items.length));
    filterNavGroups(groups, { admin: false });
    expect(JSON.stringify(groups.map((g) => g.items.length))).toBe(before);
  });
});

describe("isPathActive", () => {
  test("matches the exact path", () => {
    expect(isPathActive("/today", "/today")).toBe(true);
  });

  test("matches nested paths on a segment boundary", () => {
    expect(isPathActive("/admin/users/abc", "/admin/users")).toBe(true);
  });

  test("does not match a sibling that only shares a prefix", () => {
    expect(isPathActive("/admin/users-archive", "/admin/users")).toBe(false);
    expect(isPathActive("/account", "/account/profile")).toBe(false);
  });

  test("ignores trailing slashes", () => {
    expect(isPathActive("/today/", "/today")).toBe(true);
    expect(isPathActive("/today", "/today/")).toBe(true);
  });
});

describe("filterNavGroups with children", () => {
  const nested: NavGroup<Ctx>[] = [
    {
      label: "Settings",
      items: [
        {
          label: "Account",
          to: "/account/security",
          children: [
            { label: "Profile", to: "/account/security" },
            { label: "Preferences", to: "/mistakes", visible: (ctx) => ctx.admin },
          ],
        },
        {
          label: "Admin",
          to: "/admin/users",
          children: [{ label: "Audit", to: "/admin/activity", visible: (ctx) => ctx.admin }],
        },
        { label: "Empty", to: "/admin/activity", children: [] },
        {
          label: "Hidden parent",
          to: "/games",
          visible: (ctx) => ctx.admin,
          children: [{ label: "Child", to: "/today" }],
        },
      ],
    },
  ];

  test("keeps visible children and drops hidden ones", () => {
    const [group] = filterNavGroups(nested, { admin: false });
    expect(group?.items.map((i) => i.label)).toEqual(["Account"]);
    expect(group?.items[0]?.children?.map((c) => c.label)).toEqual(["Profile"]);
  });

  test("hides a parent whose children are all hidden or that has no children left", () => {
    const [group] = filterNavGroups(nested, { admin: false });
    expect(group?.items.some((i) => i.label === "Admin")).toBe(false);
    expect(group?.items.some((i) => i.label === "Empty")).toBe(false);
  });

  test("shows everything for an admin and a hidden parent hides its visible children", () => {
    const [group] = filterNavGroups(nested, { admin: true });
    expect(group?.items.map((i) => i.label)).toEqual(["Account", "Admin", "Hidden parent"]);
    expect(group?.items[0]?.children?.map((c) => c.label)).toEqual(["Profile", "Preferences"]);
    expect(
      filterNavGroups(nested, { admin: false })[0]?.items.some((i) => i.label === "Hidden parent"),
    ).toBe(false);
  });

  test("drops a group whose only parent lost all children, without mutating the input", () => {
    const only: NavGroup<Ctx>[] = [
      {
        label: "G",
        items: [
          {
            label: "P",
            to: "/account",
            children: [{ label: "C", to: "/account/profile", visible: () => false }],
          },
        ],
      },
    ];
    expect(filterNavGroups(only, { admin: true })).toEqual([]);
    expect(only[0]?.items[0]?.children).toHaveLength(1);
  });
});

describe("isNavItemActive", () => {
  const parent: NavItem = {
    label: "Account",
    to: "/account/danger",
    children: [
      { label: "Profile", to: "/account/security" },
      { label: "Preferences", to: "/mistakes" },
    ],
  };

  test("a leaf is active like isPathActive", () => {
    expect(isNavItemActive("/today/x", { label: "D", to: "/today" })).toBe(true);
    expect(isNavItemActive("/other", { label: "D", to: "/today" })).toBe(false);
  });

  test("a parent is active when a child route is active", () => {
    expect(isNavItemActive("/mistakes/1", parent)).toBe(true);
  });

  test("a parent is active on its own path and inactive elsewhere", () => {
    expect(isNavItemActive("/account/danger", parent)).toBe(true);
    expect(isNavItemActive("/account/profile", parent)).toBe(false);
  });
});

describe("flattenNavItems", () => {
  test("returns items in order: a parent's own landing path, then its children", () => {
    const items: NavItem[] = [
      { label: "A", to: "/today" },
      {
        label: "P",
        to: "/account",
        children: [
          { label: "C1", to: "/account/profile" },
          { label: "C2", to: "/account/security" },
        ],
      },
      { label: "B", to: "/games" },
    ];
    expect(flattenNavItems(items).map((i) => i.label)).toEqual(["A", "P", "C1", "C2", "B"]);
  });

  test("omits a parent whose landing path is already one of its descendants", () => {
    const items: NavItem[] = [
      {
        label: "P",
        to: "/account/profile",
        children: [
          { label: "C1", to: "/account/profile" },
          { label: "C2", to: "/account/security" },
        ],
      },
    ];
    expect(flattenNavItems(items).map((i) => i.label)).toEqual(["C1", "C2"]);
  });
});

describe("getBreadcrumbs", () => {
  const groups: NavGroup[] = [
    { label: "Dashboard", items: [{ label: "Dashboard", to: "/today" }] },
    {
      label: "Settings",
      items: [
        { label: "General", to: "/account/profile" },
        {
          label: "Access",
          to: "/account/danger",
          children: [
            { label: "Profile", to: "/account/security" },
            { label: "Preferences", to: "/mistakes" },
          ],
        },
      ],
    },
  ];

  test("group > item, last without `to`", () => {
    expect(getBreadcrumbs(groups, "/account/profile")).toEqual([
      { label: "Settings" },
      { label: "General" },
    ]);
  });

  test("group > parent (linked) > child for a nested active child", () => {
    expect(getBreadcrumbs(groups, "/mistakes")).toEqual([
      { label: "Settings" },
      { label: "Access", to: "/account/danger" },
      { label: "Preferences" },
    ]);
  });

  test("matches deeper paths and trailing slashes", () => {
    expect(getBreadcrumbs(groups, "/account/security/abc/")).toEqual([
      { label: "Settings" },
      { label: "Access", to: "/account/danger" },
      { label: "Profile" },
    ]);
  });

  test("does not repeat a group label equal to its item label", () => {
    expect(getBreadcrumbs(groups, "/today")).toEqual([{ label: "Dashboard" }]);
  });

  test("prefers the most specific match", () => {
    const g: NavGroup[] = [
      {
        label: "G",
        items: [
          { label: "Root", to: "/account" },
          { label: "Deep", to: "/account/profile" },
        ],
      },
    ];
    expect(getBreadcrumbs(g, "/account/profile/x")).toEqual([{ label: "G" }, { label: "Deep" }]);
  });

  test("a parent whose `to` equals its first child's prefers the deeper match", () => {
    const g: NavGroup[] = [
      {
        label: "Personal",
        items: [
          {
            label: "Settings",
            to: "/account/profile",
            children: [
              { label: "General", to: "/account/profile" },
              { label: "Profile", to: "/account/security" },
            ],
          },
        ],
      },
    ];
    expect(getBreadcrumbs(g, "/account/profile")).toEqual([
      { label: "Personal" },
      { label: "Settings", to: "/account/profile" },
      { label: "General" },
    ]);
  });

  test("returns an empty list for an unknown path or no groups", () => {
    expect(getBreadcrumbs(groups, "/nope")).toEqual([]);
    expect(getBreadcrumbs([], "/today")).toEqual([]);
  });
});
