import type { ImportStatus } from "@b2c-template/api/context";

type SyncStarter = {
  status(userId: string): Promise<ImportStatus>;
  startSync(
    userId: string,
    signal: AbortSignal,
  ): Promise<{ status: ImportStatus; done: Promise<void> }>;
};

/**
 * Runs imports in the background, one `AbortController` per running import (ADR-10). `stop()`
 * aborts them all: the DB lease is left to expire and the next trigger resumes from the committed
 * cursor.
 */
export function createImportRunner(service: SyncStarter) {
  const active = new Map<string, AbortController>();

  return {
    /** Starts a sync without waiting for it. Returns the status right after the lease attempt. */
    async start(userId: string): Promise<ImportStatus> {
      if (active.has(userId)) {
        return service.status(userId);
      }
      const controller = new AbortController();
      active.set(userId, controller);
      try {
        const { status, done } = await service.startSync(userId, controller.signal);
        void done
          .catch((error: unknown) => {
            console.error("Lichess import crashed", error);
          })
          .finally(() => {
            active.delete(userId);
          });
        return status;
      } catch (error) {
        active.delete(userId);
        throw error;
      }
    },
    stop(): void {
      for (const controller of active.values()) {
        controller.abort();
      }
      active.clear();
    },
    activeCount(): number {
      return active.size;
    },
  };
}

export type ImportRunner = ReturnType<typeof createImportRunner>;
