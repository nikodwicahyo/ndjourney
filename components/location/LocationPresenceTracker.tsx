"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { useShareLocation } from "@/hooks/useLocation";
import { useBackgroundLocationWakeLock } from "@/hooks/useBackgroundLocation";

const WAKE_TOAST_KEY = "location-wake-notice-shown";

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
  const { data: session } = useSession();
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

  const sharing = data?.isSharing === true;
  useShareLocation(data?.isSharing ?? null, session?.user?.id);
  const wakeStatus = useBackgroundLocationWakeLock();

  // The screen-on requirement is real but repeating it is noise. Once per tab
  // session; the persistent banner on /location carries the standing reminder.
  useEffect(() => {
    if (!sharing || wakeStatus !== "unsupported") return;
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(WAKE_TOAST_KEY)) return;
    sessionStorage.setItem(WAKE_TOAST_KEY, "1");
    toast.warning("Biarkan layar tetap menyala", {
      description:
        "Browser ini belum mendukung wake lock. GPS bisa berhenti saat layar mati atau aplikasi di latar belakang.",
      duration: 8000,
    });
  }, [sharing, wakeStatus]);

  return null;
}
