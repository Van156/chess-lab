import type { LinkProps } from "@tanstack/react-router";

import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { useToday } from "../hooks/use-today";
import StartReviewButton from "./start-review-button";
import TodayView from "./today-view";

/**
 * `/today` (container): reads the summary and sync status, wires "Sync now" and the review
 * prefetch into the presentational `TodayView`. `reviewTo` is the review route; it stays unset
 * until that screen exists, and the start action renders disabled meanwhile.
 */
export default function TodayPage({ reviewTo }: { reviewTo?: NonNullable<LinkProps["to"]> }) {
  const today = useToday();

  if (today.isPending) {
    return <Loader />;
  }
  if (!today.data) {
    return <LoadError message="Today could not be loaded." onRetry={today.retry} />;
  }
  return (
    <TodayView
      summary={today.data}
      now={today.now}
      reviewAction={<StartReviewButton to={reviewTo} onPrefetch={today.prefetchReview} />}
      onSyncNow={today.syncNow}
      syncPending={today.syncPending}
    />
  );
}
