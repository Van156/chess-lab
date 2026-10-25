import { describe, expect, test } from "bun:test";

import { inOverlay, isTextEntry, keyEventIgnored, modalOpen, usesArrows } from "./arrow-controls";

/** A DOM-free target: `closest` answers true for the selectors that name one of its roles. */
const target = (...matches: string[]) =>
  ({
    closest: (selector: string) => (matches.some((match) => selector.includes(match)) ? {} : null),
  }) as unknown as EventTarget;

const documentWith = (modal: boolean) => ({
  querySelector: (selector: string) => (modal && selector.includes("aria-modal") ? {} : null),
});

describe("usesArrows", () => {
  test("is true inside a text field, tab, slider, radio or spinbutton", () => {
    for (const marker of ["input", 'role="tab"', 'role="slider"', 'role="radio"', "spinbutton"]) {
      expect(usesArrows(target(marker))).toBe(true);
    }
  });

  test("is false for anything else, and for no target", () => {
    expect(usesArrows(target())).toBe(false);
    expect(usesArrows(null)).toBe(false);
    expect(usesArrows({} as EventTarget)).toBe(false);
  });
});

describe("isTextEntry", () => {
  test("is true in inputs, textareas, selects and contenteditable", () => {
    expect(isTextEntry(target("input"))).toBe(true);
    expect(isTextEntry(target("textarea"))).toBe(true);
    expect(isTextEntry(target("select"))).toBe(true);
    expect(isTextEntry(target("contenteditable"))).toBe(true);
  });

  test("is false for tabs and sliders, which keep the arrows but not undo", () => {
    expect(isTextEntry(target('role="tab"'))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});

describe("inOverlay", () => {
  test("is true inside a dialog, alertdialog, menu, listbox or combobox", () => {
    for (const role of ["dialog", "alertdialog", "menu", "listbox", "combobox"]) {
      expect(inOverlay(target(`role="${role}"`))).toBe(true);
    }
  });

  test("is false elsewhere", () => {
    expect(inOverlay(target())).toBe(false);
    expect(inOverlay(null)).toBe(false);
  });
});

describe("modalOpen", () => {
  test("is true while an aria-modal element is in the document", () => {
    expect(modalOpen(documentWith(true))).toBe(true);
    expect(modalOpen(documentWith(false))).toBe(false);
  });

  test("is false without a document", () => {
    expect(modalOpen(null)).toBe(false);
  });
});

describe("keyEventIgnored", () => {
  const event = (overrides: { defaultPrevented?: boolean; target?: EventTarget | null } = {}) => ({
    defaultPrevented: false,
    target: null,
    ...overrides,
  });

  test("lets a plain event through", () => {
    expect(keyEventIgnored(event(), documentWith(false))).toBe(false);
  });

  test("skips an event someone already handled", () => {
    expect(keyEventIgnored(event({ defaultPrevented: true }), documentWith(false))).toBe(true);
  });

  test("skips an event from inside an overlay", () => {
    expect(keyEventIgnored(event({ target: target('role="menu"') }), documentWith(false))).toBe(
      true,
    );
  });

  test("skips every event while a modal is open", () => {
    expect(keyEventIgnored(event(), documentWith(true))).toBe(true);
  });
});
