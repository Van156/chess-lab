import { useEffect, useRef } from "react";

/** True when the key press belongs to a text field, so typing never triggers an answer. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Document-wide single-key shortcuts for answer buttons. The handler gets the lower-case key and
 * whether Shift was held; presses with Ctrl, Alt or Meta, repeats and typing are ignored.
 * It returns true when it used the key, which then has its default action prevented.
 */
export function useAnswerKeys(onKey: (key: string, shift: boolean) => boolean) {
  const handler = useRef(onKey);
  handler.current = onKey;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isTyping(event.target)) return;
      if (handler.current(event.key.toLowerCase(), event.shiftKey)) event.preventDefault();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
