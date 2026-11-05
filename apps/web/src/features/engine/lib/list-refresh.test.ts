import { describe, expect, test } from "bun:test";

import { LIVE_REFRESH_MAX_PAGES, listRefetchType } from "./list-refresh";

describe("listRefetchType", () => {
  test("a list with few loaded pages is refetched live", () => {
    expect(listRefetchType([0])).toBe("active");
    expect(listRefetchType([1])).toBe("active");
    expect(listRefetchType([LIVE_REFRESH_MAX_PAGES])).toBe("active");
  });

  test("a deeply loaded list is only marked stale, so one game does not refetch every page", () => {
    expect(listRefetchType([LIVE_REFRESH_MAX_PAGES + 1])).toBe("none");
  });

  test("the deepest of several cached lists (for example one per game filter) decides", () => {
    expect(listRefetchType([1, LIVE_REFRESH_MAX_PAGES + 1])).toBe("none");
    expect(listRefetchType([])).toBe("active");
  });
});
