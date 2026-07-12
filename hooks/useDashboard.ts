"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardStats, RecentActivity } from "@/types";
import type { CoupleConfig } from "@/types";

export const dashboardKeys = queryKeys.dashboard;

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      const json = await res.json();
      return json.data as DashboardStats;
    },
    staleTime: 600_000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: dashboardKeys.activity(),
    queryFn: async () => {
      const res = await fetch("/api/dashboard/activity");
      if (!res.ok) return [];
      const json = await res.json();
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
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? null) as CoupleConfig | null;
    },
    staleTime: 600_000,
  });
}
