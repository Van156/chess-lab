/** Controls that read the arrow keys for themselves: text fields, tab lists, sliders and the like. */
const ARROW_CONTROLS =
  'input, textarea, select, [contenteditable="true"], [role="tab"], [role="slider"], [role="radio"], [role="spinbutton"]';

/** Controls that edit text and so own the native undo. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** Surfaces that take the keyboard while they are open: a key pressed inside one is theirs. */
const OVERLAYS =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="combobox"]';

/** A document, or anything that can look an element up by selector. */
type Searchable = Pick<ParentNode, "querySelector">;

/** The part of a key event the page-level shortcuts look at. */
export type KeyEventLike = { defaultPrevented: boolean; target: EventTarget | null };

/** Structural rather than `instanceof Element`, so it also works for targets from another realm. */
function matches(target: EventTarget | null, selector: string): boolean {
  if (typeof target !== "object" || target === null || !("closest" in target)) return false;
  const { closest } = target;
  return typeof closest === "function" && closest.call(target, selector) !== null;
}

/** True when a key event came from a control that needs the arrows (and Home/End) for itself. */
export function usesArrows(target: EventTarget | null): boolean {
  return matches(target, ARROW_CONTROLS);
}

/** True when a key event came from a field where typing, and so the native undo, belongs. */
export function isTextEntry(target: EventTarget | null): boolean {
  return matches(target, TEXT_ENTRY);
}

/** True when a key event came from inside a dialog, menu, listbox or combobox. */
export function inOverlay(target: EventTarget | null): boolean {
  return matches(target, OVERLAYS);
}

/** True while a modal dialog is open anywhere, whatever has the focus. */
export function modalOpen(
  root: Searchable | null = typeof document === "undefined" ? null : document,
): boolean {
  return root !== null && root.querySelector('[aria-modal="true"]') !== null;
}

/**
 * True when a page-level key shortcut must stand aside: the event was already handled, it comes
 * from an overlay that owns the keyboard, or a modal is open.
 */
export function keyEventIgnored(event: KeyEventLike, root?: Searchable | null): boolean {
  return event.defaultPrevented || inOverlay(event.target) || modalOpen(root);
}
