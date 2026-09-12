"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { CloudinaryUsage } from "@/types";

export const storageKeys = queryKeys.storage;

export function useStorageUsage() {
  return useQuery({
    queryKey: storageKeys.usage(),
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/storage/usage", { signal });
      if (!res.ok) throw new Error("Gagal memuat penggunaan penyimpanan");
      const json = await res.json();
      return json.data as CloudinaryUsage;
    },
    // ponytail: usage changes only on upload/delete (pusher INVALIDATES then) —
    // no 30s poll, no mount-storm on staleTime:0.
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });
}
