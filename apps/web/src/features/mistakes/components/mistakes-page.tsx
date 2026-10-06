import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { useMistakes } from "../hooks/use-mistakes";
import MistakesView from "./mistakes-view";

/** `/mistakes` (container): loads the list, optionally narrowed to one game (`gameId`). */
export default function MistakesPage({ gameId }: { gameId?: string }) {
  const list = useMistakes(gameId);

  if (list.isPending) {
    return <Loader />;
  }
  if (!list.mistakes) {
    return <LoadError message="Your mistakes could not be loaded." onRetry={list.retry} />;
  }
  return (
    <MistakesView
      mistakes={list.mistakes}
      filteredByGame={gameId !== undefined}
      hasMore={list.hasMore}
      loadingMore={list.loadingMore}
      onLoadMore={list.loadMore}
    />
  );
}
