"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { haversineMeters, isMeeting, MEET_THRESHOLD_METERS } from "@/lib/geo";
import {
  fetchRoadRoute,
  reverseGeocodeName,
  type LatLng,
  type RoadRoute,
} from "@/lib/routing";
import type { VisitedStop } from "@/lib/location-history";
import { initBackgroundLocation, useBackgroundLocationStatus, useBackgroundLocationCleanup } from "./useBackgroundLocation";

export type LocationPoint = {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  updatedAt: string;
};

export type PersonLocationInfo = {
  userId: string;
  image: string | null;
  isSharing: boolean;
  deviceType: string;
  location: LocationPoint | null;
  locationAgeSeconds: number | null;
  isStale: boolean;
};

export type LocationState = {
  meetThresholdMeters: number;
  coupleId: string;
  self: PersonLocationInfo & { name?: string };
  partner: PersonLocationInfo & { name: string };
};

export type FloatingHeartEvent = {
  fromUserId: string;
  emoji: string;
  at: string;
};

export type LocationHistoryPoint = {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  createdAt: string;
  deviceType: string;
};

const POLL_INTERVAL_MS = 15_000;

export function useLocationSettings() {
  return useQuery({
    queryKey: queryKeys.location.all,
    queryFn: async ({ signal }) => {
      // P-15: abort superseded polls.
      const res = await fetch("/api/location", { cache: "no-store", signal });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Gagal mengambil lokasi");
      }
      const json = await res.json();
      return json.data as LocationState;
    },
    staleTime: 10_000,
    refetchInterval: POLL_INTERVAL_MS,
    // no background-tab polling — Pusher LOCATION covers live updates.
    refetchIntervalInBackground: false,
    retry: (count, err) => {
      // don't loop 401s on every poll.
      if (err instanceof Error && /401|403|404/.test(err.message)) return false;
      return count < 2;
    },
  });
}

export type LocationHistoryResult = {
  points: LocationHistoryPoint[];
  range: string;
  count: number;
  truncated: boolean;
  oldestAt: string | null;
  newestAt: string | null;
};

export function useLocationHistory(
  range: string = "24h",
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [...queryKeys.location.all, "history", range],
    enabled: options.enabled ?? true,
    queryFn: async ({ signal }): Promise<LocationHistoryResult> => {
      const url = range ? `/api/location/history?range=${encodeURIComponent(range)}` : "/api/location/history";
      const res = await fetch(url, { cache: "no-store", signal });
      if (!res.ok) throw new Error("Gagal memuat riwayat lokasi");
      const json = await res.json();
      const points = (Array.isArray(json.data) ? json.data : []) as LocationHistoryPoint[];
      return {
        points,
        range: json.range ?? range,
        count: json.count ?? points.length,
        truncated: json.truncated === true,
        oldestAt: json.oldestAt ?? null,
        newestAt: json.newestAt ?? null,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    // history barely moves — never poll it from background tabs.
    refetchIntervalInBackground: false,
  });
}

/** Road geometry for the live partner line. Keyed by 4-dp coords (~11m), so
 * small GPS jitter does not trigger a new request every poll. */
export function useRoadRoute(from: LatLng | null, to: LatLng | null, enabled: boolean) {
  const fromKey = from ? `${from.lat.toFixed(4)},${from.lng.toFixed(4)}` : "";
  const toKey = to ? `${to.lat.toFixed(4)},${to.lng.toFixed(4)}` : "";
  return useQuery({
    queryKey: [...queryKeys.location.all, "route", fromKey, toKey],
    queryFn: ({ signal }) => fetchRoadRoute(from as LatLng, to as LatLng, { signal }),
    enabled: enabled && !!from && !!to,
    staleTime: 60_000,
    retry: false,
    refetchInterval: false,
  });
}

/** Place names for visited stops, fetched at Nominatim's ~1 req/s pace. */
export function usePlaceNames(stops: VisitedStop[]) {
  const [names, setNames] = useState<Record<string, string | null>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const pump = async (): Promise<void> => {
      if (cancelled) return;
      const pending = stops.filter((s) => !fetchedRef.current.has(s.id));
      if (pending.length === 0) return;
      const next = pending[0];
      const name = await reverseGeocodeName(next.latitude, next.longitude, {
        signal: controller.signal,
      }).catch(() => null);
      if (cancelled) return;
      // Mark only after the response lands: a re-render mid-flight must retry
      // the abandoned stop instead of leaving it permanently unnamed.
      fetchedRef.current.add(next.id);
      setNames((prev) => ({ ...prev, [next.id]: name }));
      timer = setTimeout(() => void pump(), 1100);
    };

    void pump();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [stops]);

  return names;
}

export function useDistance(state: LocationState | undefined): number | null {
  if (!state?.self.location || !state?.partner.location) return null;
  return haversineMeters(
    { latitude: state.self.location.lat, longitude: state.self.location.lng },
    { latitude: state.partner.location.lat, longitude: state.partner.location.lng },
  );
}

export function useIsMeeting(state: LocationState | undefined): boolean {
  const distance = useDistance(state);
  if (distance === null) return false;
  return isMeeting(distance);
}

export function useToggleShare() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (isSharing: boolean) => {
      const res = await fetch("/api/location/share", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSharing }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah pengaturan");
      return json.data as { isSharing: boolean };
    },
    onMutate: async (isSharing) => {
      await qc.cancelQueries({ queryKey: queryKeys.location.all });
      const previous = qc.getQueryData<LocationState>(queryKeys.location.all);
      if (previous) {
        qc.setQueryData<LocationState>(queryKeys.location.all, {
          ...previous,
          self: { ...previous.self, isSharing },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.location.all, ctx.previous);
      }
      toast.error("Gagal mengubah berbagi lokasi");
    },
    onSuccess: (data) => {
      toast.success(
        data.isSharing ? "Berbagi lokasi diaktifkan" : "Berbagi lokasi dimatikan",
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.location.all, refetchType: "all" });
    },
  });
}

export function useSendHeart() {
  return useMutation<void, Error, string | undefined>({
    mutationFn: async (emoji = "❤️") => {
      const res = await fetch("/api/location/heart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim");
      return json.data;
    },
  });
}

export function useFloatingHearts(coupleId: string | undefined) {
  const [heart, setHeart] = useState<FloatingHeartEvent | null>(null);
  const { data: session } = useSession();
  const selfId = session?.user?.id;

  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    // Lazy-load pusher so guests (and pages without realtime) don't pay for it.
    void (async () => {
      try {
        const { getPusherClient } = await import("@/lib/pusher-client");
        if (cancelled) return;

        const pusher = getPusherClient();
        const channel = pusher.subscribe(`private-couple-${coupleId}`);
        const handler = (data: FloatingHeartEvent) => {
          if (data.fromUserId && data.fromUserId !== selfId) {
            setHeart(data);
          }
        };
        channel.bind("location-heart", handler);
        unsubscribe = () => {
          channel.unbind("location-heart", handler);
          pusher.unsubscribe(`private-couple-${coupleId}`);
        };
      } catch (error) {
        console.warn("[useFloatingHearts] realtime unavailable:", error);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [coupleId, selfId]);

  return { heart, clearHeart: () => setHeart(null) };
}

export function useShareLocation(enabled: boolean) {
  const qc = useQueryClient();

  useBackgroundLocationCleanup();

  useEffect(() => {
    initBackgroundLocation(enabled, qc);
    // cleanup on unmount / enabled flip so a stale watch can't survive.
    return () => initBackgroundLocation(false, qc);
  }, [enabled, qc]);

  const status = useBackgroundLocationStatus();

  return { status, MEET_THRESHOLD_METERS };
}
