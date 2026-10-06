import { History } from "lucide-react";
import type { ReactNode } from "react";

import EmptyState from "@/shared/components/feedback/empty-state";
import LoadMore from "@/shared/components/feedback/load-more";
import PageHeader from "@/shared/components/layout/page-header";

import type { GameItem } from "../lib/games-types";
import GameRow from "./game-row";

export type GamesViewProps = {
  games: readonly GameItem[];
  /** Total imported so far, when the sync status is known. */
  importedCount?: number | null;
  /** The sync status line with its "Sync now" action; the container supplies it. */
  sync: ReactNode;
  hasMore: boolean;
  loadingMore: boolean;
  /** Fetching the next page failed; the pages already loaded stay. */
  loadMoreFailed?: boolean;
  onLoadMore: () => void;
  showMistakesLink: boolean;
};

/**
 * Games screen (presentational): sync status, the imported games with their analysis state, paging.
 * The route owns the page width, because it also lays out the analysis status beside this view.
 */
export default function GamesView({
  games,
  importedCount = null,
  sync,
  hasMore,
  loadingMore,
  loadMoreFailed = false,
  onLoadMore,
  showMistakesLink,
}: GamesViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Games"
        description={
          importedCount === null
            ? undefined
            : `${importedCount} ${importedCount === 1 ? "game" : "games"} imported`
        }
      />
      {sync}
      {games.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No games yet"
          description="Use Sync now to import your recent Lichess games."
        />
      ) : (
        <>
          <ul aria-label="Imported games" className="flex flex-col gap-3">
            {games.map((game) => (
              <li key={game.id}>
                <GameRow game={game} showMistakesLink={showMistakesLink} />
              </li>
            ))}
          </ul>
          {hasMore ? (
            <LoadMore
              noun="games"
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
