import { Button } from "@b2c-template/ui/components/button";
import { RefreshCw } from "lucide-react";

import type { SyncDescription } from "../lib/today-view-model";

const TONE_CLASS: Record<SyncDescription["tone"], string> = {
  neutral: "text-muted-foreground",
  progress: "text-muted-foreground",
  warning: "text-warning",
  error: "text-destructive",
};

/**
 * Lichess import status line with a "Sync now" button. The message is a polite live region so a
 * state change (running, backoff, failed) is announced; the button is off while syncing or waiting.
 */
export default function SyncStatus({
  description,
  onSyncNow,
  pending = false,
  showAction = true,
}: {
  description: SyncDescription;
  onSyncNow: () => void;
  /** A manual sync request is in flight. */
  pending?: boolean;
  /** Hidden while another control on the page already offers the import (onboarding). */
  showAction?: boolean;
}) {
  const running = description.tone === "progress" || pending;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p
        role="status"
        className={`flex items-center gap-2 text-sm ${TONE_CLASS[description.tone]}`}
      >
        <RefreshCw className={running ? "size-4 animate-spin" : "size-4"} aria-hidden />
        {description.message}
      </p>
      {showAction ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 min-w-11 px-4"
          disabled={!description.canSync || pending}
          onClick={onSyncNow}
        >
          Sync now
        </Button>
      ) : null}
    </div>
  );
}
