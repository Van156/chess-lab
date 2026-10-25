import { describe, expect, test } from "bun:test";

import type { KeydownHost } from "../lib/key-binding";
import type { RepertoireGraph } from "../lib/repertoire-tree";
import type { RepertoireMove } from "../lib/repertoire-types";
import { bindTreeKeys, type TreeKeyOptions } from "./use-tree-key-navigation";

const move = (id: string, from: string, to: string): RepertoireMove => ({
  id,
  fromPositionId: from,
  toPositionId: to,
  san: id,
  uci: id,
  name: null,
  isUserMove: true,
});
const e4 = move("m1", "start", "p1");
const e5 = move("m2", "p1", "p2");
const graph: RepertoireGraph = { startPositionId: "start", moves: [e4, e5] };

/** A window stand-in that records its listeners and replays keydowns through them. */
function fakeHost() {
  const listeners = new Set<(event: KeyboardEvent) => void>();
  const host: KeydownHost = {
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
  };
  const press = (key: string, overrides: Partial<KeyboardEvent> = {}) => {
    let prevented = 0;
    const event = {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      target: null,
      defaultPrevented: false,
      preventDefault: () => void prevented++,
      ...overrides,
    } as unknown as KeyboardEvent;
    for (const listener of listeners) listener(event);
    return { prevented };
  };
  return { host, press, listeners };
}

function setup(overrides: Partial<TreeKeyOptions> = {}) {
  const calls: [string, string[]][] = [];
  const options: TreeKeyOptions = {
    enabled: true,
    graph,
    path: [e4],
    baseLine: [],
    onGo: (positionId, route) => void calls.push([positionId, route]),
    root: { querySelector: () => null },
    ...overrides,
  };
  const bound = fakeHost();
  const unbind = bindTreeKeys(options, bound.host);
  return { ...bound, calls, unbind };
}

describe("tree key binding", () => {
  test("a movement key calls onGo with the target and route, and prevents the default", () => {
    const { press, calls } = setup();
    expect(press("ArrowRight").prevented).toBe(1);
    expect(calls).toEqual([["p2", ["m1", "m2"]]]);
    expect(press("ArrowLeft").prevented).toBe(1);
    expect(calls.at(-1)).toEqual(["start", []]);
  });

  test("a key that moves nothing is not prevented", () => {
    const { press, calls } = setup({ path: [e4, e5] });
    expect(press("ArrowRight").prevented).toBe(0);
    expect(press("a").prevented).toBe(0);
    expect(calls).toEqual([]);
  });

  test("an event that is already default-prevented is skipped", () => {
    const { press, calls } = setup();
    expect(press("ArrowLeft", { defaultPrevented: true }).prevented).toBe(0);
    expect(calls).toEqual([]);
  });

  test("ignores a modal being open", () => {
    const { press, calls } = setup({ root: { querySelector: () => ({}) as Element } });
    expect(press("ArrowLeft").prevented).toBe(0);
    expect(calls).toEqual([]);
  });

  test("ignores a key from inside a dialog", () => {
    const inDialog = { closest: (selector: string) => (selector.includes("dialog") ? {} : null) };
    const { press, calls } = setup();
    expect(press("ArrowLeft", { target: inDialog as unknown as EventTarget }).prevented).toBe(0);
    expect(calls).toEqual([]);
  });

  test("binds nothing while disabled, or without a graph or path", () => {
    for (const overrides of [{ enabled: false }, { graph: undefined }, { path: null }]) {
      const { listeners, unbind } = setup(overrides);
      expect(listeners.size).toBe(0);
      expect(unbind).toBeUndefined();
    }
  });

  test("the returned function unbinds the handler", () => {
    const { listeners, unbind, press, calls } = setup();
    expect(listeners.size).toBe(1);
    unbind?.();
    expect(listeners.size).toBe(0);
    press("ArrowLeft");
    expect(calls).toEqual([]);
  });
});
