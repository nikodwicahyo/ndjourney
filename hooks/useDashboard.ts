"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardStats, RecentActivity } from "@/types";
import type { CoupleConfig } from "@/types";

export const dashboardKeys = queryKeys.dashboard;

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/dashboard/stats", { signal });
      if (!res.ok) throw new Error("Gagal memuat statistik dashboard");
      const json = await res.json();
      return json.data as DashboardStats;
    },
    // ponytail: stats change on writes (pusher INVALIDATES) — poll is a fallback, not the source.
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: dashboardKeys.activity(),
    queryFn: async () => {
      const res = await fetch("/api/dashboard/activity");
      const json = await res.json().catch(() => ({}));
      // ponytail: surface errors instead of silent [] — but keep [] for 404/no-couple.
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(json.error ?? `Gagal memuat aktivitas (${res.status})`);
      return (json.data ?? []) as RecentActivity[];
    },
    staleTime: 300_000,
  });
}

export function useCoupleConfig() {
  return useQuery({
    queryKey: queryKeys.couple.config(),
    queryFn: async () => {
      const res = await fetch("/api/couple");
      if (res.status === 404) return null;
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Gagal memuat konfigurasi (${res.status})`);
      return (json.data ?? null) as CoupleConfig | null;
    },
    staleTime: 600_000,
  });
}
