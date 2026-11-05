import { buttonVariants } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { Link } from "@tanstack/react-router";

import { authClient } from "@/app/auth-client";
import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { getGradeOutbox } from "../hooks/use-grade-outbox";
import { useFirstPage, useReviewQueue } from "../hooks/use-review-queue";
import type { GradeOutbox } from "../lib/grade-outbox";
import type { QueueItem } from "../lib/review-types";
import ReviewSession from "./review-session";

function ActiveReview({
  initialItems,
  outbox,
}: {
  initialItems: readonly QueueItem[];
  outbox: GradeOutbox;
}) {
  const queue = useReviewQueue(initialItems, outbox);
  return (
    <ReviewSession
      phase={queue.phase}
      card={queue.card}
      progress={queue.progress}
      summary={queue.summary}
      onGrade={queue.grade}
      onRetryPage={queue.retryPage}
      doneAction={
        <Link to="/today" className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-6")}>
          Back to Today
        </Link>
      }
    />
  );
}

/**
 * `/review` (container): loads the first queue page and the signed-in user, then hands the
 * in-memory session to `ReviewSession`. The session mounts once, so later refetches of the first
 * page never reshuffle a session in progress.
 */
export default function ReviewPage() {
  const firstPage = useFirstPage();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  if (firstPage.isPending || !userId) {
    return <Loader />;
  }
  if (!firstPage.items) {
    return <LoadError message="The review queue could not be loaded." onRetry={firstPage.retry} />;
  }
  return <ActiveReview initialItems={firstPage.items} outbox={getGradeOutbox(userId)} />;
}
