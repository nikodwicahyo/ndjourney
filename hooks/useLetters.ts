"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { fetchJsonList } from "@/lib/fetch-json";
import type { Letter, User, LetterMood } from "@/types";

export type LetterWithUsers = Letter & {
  author: Pick<User, "id" | "name" | "image">;
  recipient: Pick<User, "id" | "name" | "image">;
};

// GET /api/letters omits `content` (list select) — the full Letter type lies here.
// GET /api/letters/[id] on a locked capsule returns this partial shape.
export type LetterListItem = Omit<LetterWithUsers, "content">;
export type LockedLetter = Pick<
  Letter,
  "id" | "title" | "isTimeCapsule" | "unlockAt" | "mood" | "createdAt"
> & {
  author: Pick<User, "id" | "name" | "image">;
};
export type LetterDetail = LetterWithUsers | LockedLetter;

export type LetterListType = "inbox" | "sent";

export type CreateLetterInput = {
  title: string;
  content: string;
  recipientId: string;
  mood: LetterMood;
  isTimeCapsule?: boolean;
  unlockAt?: string | null;
  isPublic?: boolean;
};

export const letterKeys = queryKeys.letters;

export function usePartner() {
  return useQuery({
    queryKey: queryKeys.partner.all(),
    queryFn: async () => {
      const res = await fetch("/api/partner");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Gagal memuat data pasangan");
      const json = await res.json();
      return json.data as Pick<User, "id" | "name" | "email" | "image">;
    },
    staleTime: 300_000,
    retry: false,
  });
}

export function useLetters(type: LetterListType) {
  return useQuery({
    queryKey: letterKeys.list(type),
    queryFn: async () => {
      return fetchJsonList<LetterListItem>(`/api/letters?type=${type}`);
    },
    staleTime: 30_000,
  });
}

export function useLetter(id: string) {
  return useQuery({
    queryKey: letterKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/letters/${id}`);
      if (res.status === 404) return null;
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Gagal memuat surat (${res.status})`);
      return (json.data ?? null) as LetterDetail | null;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateLetter() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLetterInput) => {
      const res = await api.post("/api/letters", data);
      if (res.error) throw new Error(res.error);
      const body = res.data as { data?: unknown } | unknown;
      return (body && typeof body === "object" && "data" in body
        ? (body as { data: unknown }).data
        : body) as LetterWithUsers;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: letterKeys.all, refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
    },
  });
}

export function useOpenLetter() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/api/letters/${id}/open`);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: letterKeys.all, refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
    },
  });
}

export function useDeleteLetter() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/letters/${id}`);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: letterKeys.all, refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
    },
  });
}
