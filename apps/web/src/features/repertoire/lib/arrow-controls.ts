/** Controls that read the arrow keys for themselves: text fields, tab lists, sliders and the like. */
const ARROW_CONTROLS =
  'input, textarea, select, [contenteditable="true"], [role="tab"], [role="slider"], [role="radio"], [role="spinbutton"]';

/** True when a key event came from a control that needs the arrows (and Home/End) for itself. */
export function usesArrows(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(ARROW_CONTROLS) !== null;
}
