"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

function queryErrorHandler(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "error" in error &&
          typeof (error as { error: string }).error === "string"
        ? (error as { error: string }).error
        : "Terjadi kesalahan";

  if (message !== "Request timed out" && !message.includes("aborted")) {
    toast.error(message, { duration: 4000 });
  }
}

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
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            onError: queryErrorHandler,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
