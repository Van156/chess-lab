import { describe, expect, test } from "bun:test";

import type { KeydownHost } from "../lib/key-binding";
import { bindUndoKey, createUndoKeyHandler } from "./use-deletion-undo";

const noModal = { querySelector: () => null };

function press(handler: (event: KeyboardEvent) => void, overrides: Partial<KeyboardEvent> = {}) {
  let prevented = 0;
  handler({
    key: "z",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    defaultPrevented: false,
    preventDefault: () => void prevented++,
    ...overrides,
  } as unknown as KeyboardEvent);
  return prevented;
}

const inside = (marker: string) =>
  ({
    closest: (selector: string) => (selector.includes(marker) ? {} : null),
  }) as unknown as EventTarget;

describe("undo key handler", () => {
  test("Ctrl+Z and Cmd+Z undo, and prevent the default only when a restore starts", () => {
    let calls = 0;
    const handler = createUndoKeyHandler({ undo: () => ++calls > 0, root: noModal });
    expect(press(handler)).toBe(1);
    expect(press(handler, { ctrlKey: false, metaKey: true })).toBe(1);
    expect(calls).toBe(2);
  });

  test("does not prevent the default when there is nothing to undo", () => {
    const handler = createUndoKeyHandler({ undo: () => false, root: noModal });
    expect(press(handler)).toBe(0);
  });

  test("leaves redo, other keys and other modifiers alone", () => {
    let calls = 0;
    const handler = createUndoKeyHandler({ undo: () => ++calls > 0, root: noModal });
    expect(press(handler, { shiftKey: true })).toBe(0);
    expect(press(handler, { key: "y" })).toBe(0);
    expect(press(handler, { ctrlKey: false })).toBe(0);
    expect(calls).toBe(0);
  });

  test("keeps the native undo in input, textarea, select and contenteditable", () => {
    let calls = 0;
    const handler = createUndoKeyHandler({ undo: () => ++calls > 0, root: noModal });
    for (const marker of ["input", "textarea", "select", "contenteditable"]) {
      expect(press(handler, { target: inside(marker) })).toBe(0);
    }
    expect(calls).toBe(0);
  });

  test("stands aside inside an overlay, while a modal is open and for a handled event", () => {
    let calls = 0;
    const undo = () => ++calls > 0;
    expect(press(createUndoKeyHandler({ undo, root: noModal }), { target: inside("dialog") })).toBe(
      0,
    );
    expect(
      press(createUndoKeyHandler({ undo, root: { querySelector: () => ({}) as Element } })),
    ).toBe(0);
    expect(press(createUndoKeyHandler({ undo, root: noModal }), { defaultPrevented: true })).toBe(
      0,
    );
    expect(calls).toBe(0);
  });

  test("binds to the host and unbinds with the returned function", () => {
    const listeners = new Set<(event: KeyboardEvent) => void>();
    const host: KeydownHost = {
      addEventListener: (_type, listener) => void listeners.add(listener),
      removeEventListener: (_type, listener) => void listeners.delete(listener),
    };
    const unbind = bindUndoKey({ undo: () => true, root: noModal }, host);
    expect(listeners.size).toBe(1);
    unbind();
    expect(listeners.size).toBe(0);
  });
});
