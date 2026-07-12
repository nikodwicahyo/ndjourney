"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { CloudinaryUsage } from "@/types";

export const storageKeys = queryKeys.storage;

export function useStorageUsage() {
  return useQuery({
    queryKey: storageKeys.usage(),
    queryFn: async () => {
      const res = await fetch("/api/storage/usage");
      if (!res.ok) throw new Error("Failed to fetch storage usage");
      const json = await res.json();
      return json.data as CloudinaryUsage;
    },
    staleTime: 60_000,
  });
}
