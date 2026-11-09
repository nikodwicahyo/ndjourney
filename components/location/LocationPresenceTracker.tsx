"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useShareLocation } from "@/hooks/useLocation";

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
  const { data } = useQuery({
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
    // The toggle mutation invalidates queryKeys.location.all, so this refetches
    // right after the button flips; it has no reason to poll otherwise.
    staleTime: 60_000,
  });

  useShareLocation(data?.isSharing === true);

  return null;
}
