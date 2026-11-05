import { describe, expect, test } from "bun:test";

import { isUndoShortcut, undoShortcutLabel, type UndoKeyEvent } from "./undo-shortcut";

const press = (overrides: Partial<UndoKeyEvent> = {}): UndoKeyEvent => ({
  key: "z",
  ctrlKey: true,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

describe("isUndoShortcut", () => {
  test("accepts Ctrl+Z and Cmd+Z on any platform", () => {
    expect(isUndoShortcut(press())).toBe(true);
    expect(isUndoShortcut(press({ ctrlKey: false, metaKey: true }))).toBe(true);
  });

  test("accepts an upper-case Z (caps lock)", () => {
    expect(isUndoShortcut(press({ key: "Z" }))).toBe(true);
  });

  test("needs ctrl or cmd", () => {
    expect(isUndoShortcut(press({ ctrlKey: false }))).toBe(false);
  });

  test("leaves Shift+Ctrl+Z (redo) and Alt alone", () => {
    expect(isUndoShortcut(press({ shiftKey: true }))).toBe(false);
    expect(isUndoShortcut(press({ altKey: true }))).toBe(false);
  });

  test("ignores other keys", () => {
    expect(isUndoShortcut(press({ key: "y" }))).toBe(false);
    expect(isUndoShortcut(press({ key: "Control" }))).toBe(false);
  });
});

describe("undoShortcutLabel", () => {
  test("names Cmd+Z on Apple platforms and Ctrl+Z elsewhere", () => {
    expect(undoShortcutLabel("MacIntel")).toBe("⌘Z");
    expect(undoShortcutLabel("iPad")).toBe("⌘Z");
    expect(undoShortcutLabel("Win32")).toBe("Ctrl+Z");
    expect(undoShortcutLabel("Linux x86_64")).toBe("Ctrl+Z");
    expect(undoShortcutLabel("")).toBe("Ctrl+Z");
  });
});
