import { describe, expect, test } from "bun:test";

import { explorerOk } from "../components/repertoire.fixtures";
import { toExplorerPanelState } from "./explorer-state";

describe("toExplorerPanelState", () => {
  test("is loading while the query is disabled or pending", () => {
    expect(toExplorerPanelState({ data: undefined, isError: false })).toEqual({
      kind: "loading",
    });
  });

  test("is failed when the request failed and there is nothing to show", () => {
    expect(toExplorerPanelState({ data: undefined, isError: true })).toEqual({
      kind: "failed",
    });
  });

  test("keeps showing the data when a background refetch failed", () => {
    expect(toExplorerPanelState({ data: explorerOk, isError: true })).toEqual({
      kind: "loaded",
      data: explorerOk,
    });
  });

  test("is loaded when there is data", () => {
    expect(toExplorerPanelState({ data: explorerOk, isError: false })).toEqual({
      kind: "loaded",
      data: explorerOk,
    });
  });
});
