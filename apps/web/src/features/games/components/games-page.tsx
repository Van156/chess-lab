import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";
import { useFeatureFlags } from "@/app/use-feature-flags";
import { SyncStatus, describeSync } from "@/features/today";

import { useGames } from "../hooks/use-games";
import { useGamesSync } from "../hooks/use-games-sync";
import GamesView from "./games-view";

/** `/games` (container): wires the games list and the Lichess sync status into `GamesView`. */
export default function GamesPage() {
  const games = useGames();
  const sync = useGamesSync();
  const { mistakes } = useFeatureFlags();

  if (games.isPending) {
    return <Loader />;
  }
  if (!games.games) {
    return <LoadError message="Your games could not be loaded." onRetry={games.retry} />;
  }
  const description = sync.status
    ? describeSync(sync.status, sync.now)
    : { tone: "neutral" as const, message: "Sync status unavailable", canSync: true };
  return (
    <GamesView
      games={games.games}
      importedCount={sync.status?.gamesImported ?? null}
      sync={
        <SyncStatus description={description} onSyncNow={sync.syncNow} pending={sync.syncPending} />
      }
      hasMore={games.hasMore}
      loadingMore={games.loadingMore}
      onLoadMore={games.loadMore}
      showMistakesLink={mistakes}
    />
  );
}
