"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { DailyNote, User } from "@/types";

export type DailyNoteWithAuthor = DailyNote & {
  author: Pick<User, "id" | "name" | "image">;
};

export const noteKeys = queryKeys.notes;

export function useDailyNotes(date?: string) {
  return useQuery({
    queryKey: noteKeys.list(date),
    queryFn: async () => {
      const params = date ? `?date=${date}` : "";
      const res = await fetch(`/api/notes${params}`);
      const json = await res.json();
      return json.data as DailyNoteWithAuthor[];
    },
    staleTime: 30_000,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat catatan");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all, refetchType: 'all' });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus catatan");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all, refetchType: 'all' });
    },
  });
}
