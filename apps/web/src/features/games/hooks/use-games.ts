import { useInfiniteQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

const PAGE_SIZE = 20;

/** Games newest first, one keyset page at a time; "Load more" asks for the next cursor. */
export function useGames() {
  const query = useInfiniteQuery(
    orpc.games.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ cursor, limit: PAGE_SIZE }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }),
  );
  return {
    games: query.data?.pages.flatMap((page) => page.items),
    isPending: query.isPending,
    isError: query.isError,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    retry: () => void query.refetch(),
  };
}
