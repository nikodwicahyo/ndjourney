"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { haversineMeters, isMeeting, MEET_THRESHOLD_METERS } from "@/lib/geo";
import { getPusherClient } from "@/lib/pusher-client";
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

const POLL_INTERVAL_MS = 8000;

async function fetchLocation(): Promise<LocationState> {
  const res = await fetch("/api/location", { cache: "no-store" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Gagal mengambil lokasi");
  }
  const json = await res.json();
  return json.data as LocationState;
}

export function useLocationSettings() {
  return useQuery({
    queryKey: queryKeys.location.all,
    queryFn: fetchLocation,
    staleTime: 5_000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useLocationHistory() {
  return useQuery({
    queryKey: [...queryKeys.location.all, "history"],
    queryFn: async () => {
      const res = await fetch("/api/location/history", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat riwayat lokasi");
      const json = await res.json();
      return json.data as LocationHistoryPoint[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
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
        data.isSharing ? "Berbagi lokasi diaktifkan 💕" : "Berbagi lokasi dimatikan",
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
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-couple-${coupleId}`);
    const handler = (data: FloatingHeartEvent) => {
      if (data.fromUserId && data.fromUserId !== selfId) {
        setHeart(data);
      }
    };
    channel.bind("location-heart", handler);
    return () => {
      channel.unbind("location-heart", handler);
      pusher.unsubscribe(`private-couple-${coupleId}`);
    };
  }, [coupleId, selfId]);

  return { heart, clearHeart: () => setHeart(null) };
}

export function useShareLocation(enabled: boolean) {
  const qc = useQueryClient();

  useBackgroundLocationCleanup();

  useEffect(() => {
    initBackgroundLocation(enabled, qc);
  }, [enabled, qc]);

  const status = useBackgroundLocationStatus();

  return { status, MEET_THRESHOLD_METERS };
}
