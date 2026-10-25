/** A key press, reduced to what decides whether it is the undo shortcut. */
export type UndoKeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

/**
 * Ctrl+Z or Cmd+Z, accepted on any platform. Shift (redo) and Alt are left alone. Where the key
 * is pressed is not decided here: see `isTextEntry` and `keyEventIgnored`.
 */
export function isUndoShortcut(event: UndoKeyEvent): boolean {
  return (
    event.key.toLowerCase() === "z" &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** How to write the undo shortcut for `platform` (`navigator.platform`): ⌘Z on Apple devices. */
export function undoShortcutLabel(platform: string): string {
  return /^(Mac|iPhone|iPad|iPod)/.test(platform) ? "⌘Z" : "Ctrl+Z";
}
