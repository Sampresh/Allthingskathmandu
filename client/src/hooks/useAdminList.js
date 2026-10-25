'use client'

import { useInfiniteQuery } from '@tanstack/react-query'

/** Cursor-paged admin list: rows from every loaded page plus the query controls. */
export function useAdminList(key, fetchPage, params = {}) {
  const query = useInfiniteQuery({
    queryKey: ['admin', key, params],
    queryFn: ({ pageParam }) => fetchPage({ ...params, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  })
  return {
    rows: query.data?.pages.flatMap((p) => p.data) ?? [],
    query,
    tableProps: {
      loading: query.isPending,
      error: query.isError,
      onRetry: () => query.refetch(),
      hasMore: query.hasNextPage,
      onLoadMore: () => query.fetchNextPage(),
      loadingMore: query.isFetchingNextPage,
    },
  }
}
