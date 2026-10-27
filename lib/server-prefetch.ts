import {
  QueryClient,
  dehydrate,
  type DehydratedState,
} from "@tanstack/react-query";

/**
 * Runs server-side query prefetches against a per-request QueryClient and
 * returns serializable state for <HydrationBoundary>.
 *
 * retry:false keeps a failing upstream (DB/Redis) from stalling SSR — client
 * hooks still fetch normally when hydration had no data, so a prefetch error
 * degrades to the previous client-fetch behaviour instead of an error page.
 */
export async function prefetchServerQueries(
  prefetches: Array<(queryClient: QueryClient) => Promise<unknown>>,
): Promise<DehydratedState> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  await Promise.all(prefetches.map((fn) => fn(queryClient)));
  return dehydrate(queryClient);
}
