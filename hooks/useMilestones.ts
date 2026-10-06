"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { Milestone } from "@/types";
import type { CropRect } from "@/lib/image-crop";

export type MilestoneWithRelations = Milestone & {
  createdBy: { id: string; name: string | null; image: string | null };
  photos: Array<{
    crop?: CropRect | null;
    photo: { id: string; url: string; thumbnailUrl: string | null; caption: string | null };
  }>;
};

export const milestoneKeys = queryKeys.milestones;

export function useMilestones() {
  return useQuery({
    queryKey: milestoneKeys.list(),
    queryFn: async () => {
      const res = await fetch("/api/milestones", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Gagal memuat milestone" }));
        throw new Error(err.error || "Gagal memuat milestone");
      }
      const json: { data?: MilestoneWithRelations[] } = await res.json();
      return json.data ?? [];
    },
    staleTime: 30_000,
    gcTime: 300_000,
  });
}

export function useMilestone(id: string) {
  return useQuery({
    queryKey: milestoneKeys.detail(id),
    queryFn: async () => {
      const res = await api.get<{ data: MilestoneWithRelations } | MilestoneWithRelations>(`/api/milestones/${id}`);
      if (res.error) throw new Error(res.error);
      const body = res.data as { data?: MilestoneWithRelations } | MilestoneWithRelations;
      return ((body as { data?: MilestoneWithRelations }).data ?? body) as MilestoneWithRelations;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      date: string;
      icon?: string;
      color?: string;
      location?: string;
      isPublic?: boolean;
      photoIds?: string[];
      photoUploads?: Array<{ url: string; publicId: string; thumbnailUrl?: string; crop?: CropRect | null }>;
      photoCrops?: Record<string, CropRect>;
    }) => api.post("/api/milestones", data).then((res) => {
      if (res.error) throw new Error(res.error);
      return (res.data as { data?: unknown }) && typeof res.data === "object" && "data" in (res.data as object)
        ? (res.data as { data: unknown }).data
        : res.data;
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: milestoneKeys.all, refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
    },
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      description?: string;
      date?: string;
      icon?: string;
      color?: string;
      location?: string;
      isPublic?: boolean;
      photoIds?: string[];
      photoUploads?: Array<{ url: string; publicId: string; thumbnailUrl?: string; crop?: CropRect | null }>;
      photoCrops?: Record<string, CropRect>;
    }) => api.put(`/api/milestones/${id}`, data).then((res) => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: milestoneKeys.all, refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
    },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/milestones/${id}`);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: milestoneKeys.all, refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
    },
  });
}
