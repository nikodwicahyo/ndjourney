"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { WishItem } from "@/types";

export const wishKeys = queryKeys.wishes;

export function useWishes() {
  return useQuery({
    queryKey: wishKeys.list(),
    queryFn: async () => {
      const res = await fetch("/api/wishes");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Gagal memuat wish list");
      }
      const json = await res.json();
      if (!Array.isArray(json.data) && json.data !== undefined) {
        throw new Error("Invalid response format");
      }
      return json.data as WishItem[];
    },
    staleTime: 30_000,
  });
}

export function useCreateWish() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      link?: string;
      category?: string;
      imageUrl?: string;
    }) => {
      const res = await fetch("/api/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambahkan wish");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wishKeys.all });
    },
  });
}

export function useUpdateWish() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      description?: string | null;
      link?: string | null;
      category?: string;
      imageUrl?: string | null;
    }) => {
      const res = await fetch(`/api/wishes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengupdate wish");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wishKeys.all });
    },
  });
}

export function useToggleWish() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => {
      const res = await fetch(`/api/wishes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengupdate wish");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wishKeys.all });
    },
  });
}

export function useDeleteWish() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wishes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus wish");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wishKeys.all });
    },
  });
}
