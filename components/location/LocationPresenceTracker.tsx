"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useShareLocation } from "@/hooks/useLocation";
import { clearQueuedFixes } from "@/hooks/useBackgroundLocation";

/**
 * The app-wide owner of the background GPS watcher.
 *
 * It used to be mounted by LocationWidget and LocationManager only, so opening
 * the app on Dashboard/Gallery never posted a fix and the partner could not
 * see a GPS that came back online. Mounted from RealtimeSyncClient (both
 * layouts, authenticated only) it runs everywhere.
 *
 * The share flag is the server's, never a guess: a client that thinks sharing
 * is on while the server says off would burn battery on 403s.
 */
export function LocationPresenceTracker() {
  const shareQuery = useQuery({
    queryKey: queryKeys.location.shareStatus(),
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/location/share", {
        signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Gagal membaca status lokasi (${res.status})`);
      const json = await res.json();
      return json.data as { isSharing: boolean };
    },
    // A cold launch on a flaky network used to leave this query failed forever,
    // which meant the watcher never started. Poll slowly and retry.
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });

  const isSharing = shareQuery.data?.isSharing === true;
  useShareLocation(isSharing);

  // Queued coordinates must not outlive an opt-out — including an opt-out made
  // on another device.
  useEffect(() => {
    if (shareQuery.isSuccess && shareQuery.data?.isSharing === false) {
      void clearQueuedFixes();
    }
  }, [shareQuery.isSuccess, shareQuery.data?.isSharing]);

  return null;
}
