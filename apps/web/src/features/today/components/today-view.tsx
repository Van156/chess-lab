import { Button } from "@b2c-template/ui/components/button";
import { CircleCheck, Download } from "lucide-react";
import type { ReactNode } from "react";

import EmptyState from "@/shared/components/feedback/empty-state";
import PageHeader from "@/shared/components/layout/page-header";

import type { TodaySummary } from "../lib/today-types";
import { describeSync, dueParts, todayMode } from "../lib/today-view-model";
import DueCard from "./due-card";
import SummaryCards from "./summary-cards";
import SyncStatus from "./sync-status";

/**
 * Today home (presentational): onboarding when nothing was imported, the due queue with its start
 * action, or the all-caught-up state. `reviewAction` is a slot so the container owns routing and
 * prefetching; `now` is injected so relative times render deterministically.
 */
export default function TodayView({
  summary,
  now,
  reviewAction,
  onSyncNow,
  syncPending = false,
}: {
  summary: TodaySummary;
  now: number;
  reviewAction: ReactNode;
  onSyncNow: () => void;
  syncPending?: boolean;
}) {
  const mode = todayMode(summary);
  const description = describeSync(summary.sync, now);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Today" />
      <SyncStatus
        description={description}
        onSyncNow={onSyncNow}
        pending={syncPending}
        showAction={mode !== "onboarding"}
      />
      {mode === "onboarding" ? (
        <EmptyState
          icon={<Download />}
          title="Import your Lichess games"
          description="Chess Lab turns the mistakes in your games into review cards."
          action={
            <Button
              size="lg"
              className="h-11 px-6"
              disabled={!description.canSync || syncPending}
              onClick={onSyncNow}
            >
              Import my games
            </Button>
          }
        />
      ) : null}
      {mode === "due" ? (
        <>
          <DueCard total={summary.dueTotal} parts={dueParts(summary.due)} action={reviewAction} />
          <SummaryCards newBudgetLeft={summary.newBudgetLeft} streak={summary.streak} />
        </>
      ) : null}
      {mode === "caught-up" ? (
        <>
          <EmptyState
            icon={<CircleCheck />}
            title="You're all caught up"
            description="Your review queue is complete for today."
          />
          <SummaryCards newBudgetLeft={summary.newBudgetLeft} streak={summary.streak} />
        </>
      ) : null}
    </div>
  );
}
