import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { keyEventIgnored, isTextEntry } from "../lib/arrow-controls";
import type { RestoreTarget } from "../lib/deletion-undo";
import { bindKeydown, type KeydownHost } from "../lib/key-binding";
import type { DeletionSnapshot } from "../lib/repertoire-types";
import {
  createUndoController,
  type UndoController,
  type UndoEntry,
  type UndoPorts,
} from "../lib/undo-controller";
import { isUndoShortcut, undoShortcutLabel } from "../lib/undo-shortcut";

/** How long the "Deleted" message stays: it is the only visible way back, so longer than usual. */
const DELETED_TOAST_MS = 10_000;

type UndoKeyOptions = {
  /** Starts a restore of the newest deletion; false when there is nothing to do. */
  undo: () => boolean;
  /** Where to look for an open modal; the document by default. */
  root?: Parameters<typeof keyEventIgnored>[1];
};

type UndoKeyEvent = Pick<
  KeyboardEvent,
  | "key"
  | "ctrlKey"
  | "metaKey"
  | "shiftKey"
  | "altKey"
  | "target"
  | "defaultPrevented"
  | "preventDefault"
>;

/**
 * The keydown handler for Ctrl/Cmd+Z. Text fields keep the native undo, overlays and open modals
 * keep their keyboard, and the default is only prevented when a restore actually starts.
 */
export function createUndoKeyHandler({ undo, root }: UndoKeyOptions) {
  return (event: UndoKeyEvent) => {
    if (!isUndoShortcut(event) || keyEventIgnored(event, root) || isTextEntry(event.target)) return;
    if (undo()) event.preventDefault();
  };
}

export function bindUndoKey(options: UndoKeyOptions, host: KeydownHost): () => void {
  return bindKeydown(host, createUndoKeyHandler(options));
}

function toastNotifier(
  undo: (id: string) => void,
  shortcut: string,
): UndoPorts<DeletionSnapshot>["notify"] {
  return {
    deleted: (entry) =>
      toast(`Deleted ${entry.label}`, {
        id: entry.id,
        description: `Press ${shortcut} to undo.`,
        duration: DELETED_TOAST_MS,
        action: { label: "Undo", onClick: () => undo(entry.id) },
        actionButtonStyle: { minHeight: 44, minWidth: 44 },
      }),
    restored: (entry) => toast(`Restored ${entry.label}`),
    failed: (message) => toast.error(message),
    dismiss: (id) => void toast.dismiss(id),
  };
}

export type DeletionUndo = Pick<UndoController<DeletionSnapshot>, "record">;

/**
 * The undo stack of a repertoire page. `record` is called after each successful delete: it shows
 * "Deleted {san}" with an Undo action and remembers the snapshot. Ctrl/Cmd+Z restores the newest
 * one, the toast's Undo a specific one; `onRestored` takes the board back. The stack is dropped
 * when the repertoire changes or the page unmounts.
 */
export function useDeletionUndo({
  repertoireId,
  restore,
  onRestored,
}: {
  repertoireId: string;
  restore: (input: {
    repertoireId: string;
    snapshot: DeletionSnapshot;
  }) => Promise<{ restoredToPositionId: string }>;
  onRestored: (target: RestoreTarget) => void;
}): DeletionUndo {
  // The controller outlives renders, so it reads the latest callbacks through a ref.
  const latest = useRef({ restore, onRestored });
  useEffect(() => {
    latest.current = { restore, onRestored };
  });

  const controller = useMemo(() => {
    const shortcut = undoShortcutLabel(typeof navigator === "undefined" ? "" : navigator.platform);
    const self: { current: UndoController<DeletionSnapshot> | null } = { current: null };
    const created = createUndoController<DeletionSnapshot>({
      restore: (snapshot) => latest.current.restore({ repertoireId, snapshot }),
      onRestored: (entry: UndoEntry<DeletionSnapshot>, positionId: string) =>
        latest.current.onRestored({ positionId, route: entry.returnTo.route }),
      notify: toastNotifier((id) => void self.current?.undo(id), shortcut),
    });
    self.current = created;
    return created;
  }, [repertoireId]);

  useEffect(() => () => controller.clear(), [controller]);
  useEffect(() => bindUndoKey({ undo: () => controller.undo() }, window), [controller]);

  return controller;
}
