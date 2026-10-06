import type { SyncDescription } from "@/features/today";

export const SYNC_REQUEST_FAILED = "Sync could not be started. Try again.";

/**
 * The "Sync now" request itself can fail (network, server), which the stored sync status does not
 * show. The failure replaces an idle status with a retryable error; a sync the server reports as
 * running or backing off is the truth and stays.
 */
export function withSyncRequestError(
  description: SyncDescription,
  requestFailed: boolean,
): SyncDescription {
  if (!requestFailed || !description.canSync) return description;
  return { tone: "error", message: SYNC_REQUEST_FAILED, canSync: true };
}
