import { buttonVariants } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Crosshair } from "lucide-react";

import EmptyState from "@/shared/components/feedback/empty-state";
import LoadMore from "@/shared/components/feedback/load-more";
import PageHeader from "@/shared/components/layout/page-header";

import type { MistakeItem } from "../lib/mistakes-types";
import MistakeRow from "./mistake-row";

export type MistakesViewProps = {
  mistakes: readonly MistakeItem[];
  /** True when the list is narrowed to one game. */
  filteredByGame: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  /** Fetching the next page failed; the pages already loaded stay. */
  loadMoreFailed?: boolean;
  onLoadMore: () => void;
};

/** Mistakes screen (presentational): the user's mistakes, newest game first, with paging. */
export default function MistakesView({
  mistakes,
  filteredByGame,
  hasMore,
  loadingMore,
  loadMoreFailed = false,
  onLoadMore,
}: MistakesViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Mistakes"
        description={filteredByGame ? "Mistakes from one game" : "Found by analysing your games"}
        actions={
          filteredByGame ? (
            <Link
              to="/mistakes"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
            >
              Show all mistakes
            </Link>
          ) : undefined
        }
      />
      {mistakes.length === 0 ? (
        <EmptyState
          icon={<Crosshair />}
          title="No mistakes yet"
          description={
            filteredByGame
              ? "This game has no mistakes, or it is still being analysed."
              : "Mistakes appear here once your games have been analysed."
          }
        />
      ) : (
        <>
          <ul aria-label="Mistakes" className="flex flex-col gap-3">
            {mistakes.map((mistake) => (
              <li key={mistake.id}>
                <MistakeRow mistake={mistake} />
              </li>
            ))}
          </ul>
          {hasMore ? (
            <LoadMore
              noun="mistakes"
              loading={loadingMore}
              failed={loadMoreFailed}
              onLoadMore={onLoadMore}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
