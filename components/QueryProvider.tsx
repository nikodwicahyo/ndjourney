"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 2,
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 5000),
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
          mutations: {
            // Writes must never retry: a retried create/update can double-apply
            // (or surface a stale error after a successful commit).
            retry: 0,
            // No global mutation onError: each action owns its loading→settle
            // toast (lib/mutation-feedback). A global toast here would double
            // every error, because TanStack runs the cache handler AND the
            // mutation's own onError.
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
