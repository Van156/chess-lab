import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

const PAGE_SIZE = 20;

/** Mistakes newest game first, optionally for one game; "Load more" asks for the next cursor. */
export function useMistakes(gameId: string | undefined) {
  const query = useInfiniteQuery(
    orpc.mistakes.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ cursor, limit: PAGE_SIZE, gameId }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }),
  );
  return {
    mistakes: query.data?.pages.flatMap((page) => page.items),
    isPending: query.isPending,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    retry: () => void query.refetch(),
  };
}

/** One mistake with its game; the error is kept so the page can tell "not found" from a failure. */
export function useMistake(id: string) {
  const query = useQuery(orpc.mistakes.get.queryOptions({ input: { id } }));
  return {
    mistake: query.data,
    error: query.error,
    isPending: query.isPending,
    retry: () => void query.refetch(),
  };
}
