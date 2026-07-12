"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { Letter, User, LetterMood } from "@/types";

export type LetterWithUsers = Letter & {
  author: Pick<User, "id" | "name" | "image">;
  recipient: Pick<User, "id" | "name" | "image">;
};

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
      const res = await fetch(`/api/letters?type=${type}`);
      const json = await res.json();
      return (json.data ?? []) as LetterWithUsers[];
    },
    staleTime: 30_000,
  });
}

export function useLetter(id: string) {
  return useQuery({
    queryKey: letterKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/letters/${id}`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? null) as LetterWithUsers | null;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateLetter() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLetterInput) =>
      api.post("/api/letters", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: letterKeys.all });
    },
  });
}

export function useOpenLetter() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.put(`/api/letters/${id}/open`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: letterKeys.all });
    },
  });
}

export function useDeleteLetter() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/letters/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: letterKeys.all });
    },
  });
}
