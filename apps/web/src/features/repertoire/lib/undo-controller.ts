import {
  findEntry,
  newestEntry,
  pushEntry,
  removeEntry,
  type RestoreTarget,
} from "./deletion-undo";
import { describeRestoreFailure, isMoveExistsConflict } from "./restore-failure";

/** One undoable deletion: what the server returned for it, how to name it and where to go back. */
export type UndoEntry<Snapshot> = {
  id: string;
  snapshot: Snapshot;
  /** The deleted move in SAN, for messages. */
  label: string;
  returnTo: RestoreTarget;
};

/** What the controller needs from the outside: the restore call, the navigation and the messages. */
export type UndoPorts<Snapshot> = {
  /** Resolves with the position the restored move lands on, which the server may have remapped. */
  restore: (snapshot: Snapshot) => Promise<{ restoredToPositionId: string }>;
  /** Called after a restore succeeded; the page goes to `positionId` along `entry.returnTo.route`. */
  onRestored: (entry: UndoEntry<Snapshot>, positionId: string) => void;
  notify: {
    deleted: (entry: UndoEntry<Snapshot>) => void;
    restored: (entry: UndoEntry<Snapshot>) => void;
    failed: (message: string) => void;
    /** Drops the deletion message of an entry that is no longer undoable. */
    dismiss: (id: string) => void;
  };
};

let nextId = 0;

/**
 * The undo stack of one repertoire page. `undo()` restores the newest deletion and `undo(id)` a
 * specific one; only one restore runs at a time. A restore that fails for a transient reason keeps
 * its entry for another try; any other failure drops it. Nothing here knows about React or toasts.
 */
export function createUndoController<Snapshot>(ports: UndoPorts<Snapshot>) {
  let stack: UndoEntry<Snapshot>[] = [];
  let pending = false;
  let epoch = 0;
  /** Entries whose restore failed in a way that may have committed or may pass. */
  let retried = new Set<string>();

  const drop = (id: string) => {
    stack = removeEntry(stack, id);
    ports.notify.dismiss(id);
  };

  async function run(entry: UndoEntry<Snapshot>) {
    const started = epoch;
    const finish = (positionId: string) => {
      drop(entry.id);
      retried.delete(entry.id);
      ports.notify.restored(entry);
      ports.onRestored(entry, positionId);
    };
    try {
      const { restoredToPositionId } = await ports.restore(entry.snapshot);
      if (started !== epoch) return;
      finish(restoredToPositionId);
    } catch (failure) {
      if (started !== epoch) return;
      // After an earlier failed attempt, "the move exists" means that attempt did commit.
      if (retried.has(entry.id) && isMoveExistsConflict(failure)) {
        finish(entry.returnTo.positionId);
        return;
      }
      const { message, retryable } = describeRestoreFailure(failure);
      if (retryable) retried.add(entry.id);
      else {
        drop(entry.id);
        retried.delete(entry.id);
      }
      ports.notify.failed(message);
    } finally {
      if (started === epoch) pending = false;
    }
  }

  return {
    /** Remembers a deletion and announces it. */
    record(input: Omit<UndoEntry<Snapshot>, "id">): UndoEntry<Snapshot> {
      const entry = { ...input, id: `undo-${++nextId}` };
      stack = pushEntry(stack, entry);
      ports.notify.deleted(entry);
      return entry;
    },
    /** Starts a restore; false when there is nothing to restore or one is already running. */
    undo(id?: string): boolean {
      if (pending) return false;
      const entry = id === undefined ? newestEntry(stack) : findEntry(stack, id);
      if (!entry) return false;
      pending = true;
      void run(entry);
      return true;
    },
    entries: (): readonly UndoEntry<Snapshot>[] => stack,
    size: () => stack.length,
    /** Forgets every entry, e.g. when the repertoire changes; a restore in flight is ignored. */
    clear() {
      stack = [];
      retried = new Set();
      pending = false;
      epoch++;
    },
  };
}

export type UndoController<Snapshot> = ReturnType<typeof createUndoController<Snapshot>>;
