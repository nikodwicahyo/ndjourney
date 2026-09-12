"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchJsonList } from "@/lib/fetch-json";
import type { GameQuestion, GameType } from "@/types";
import type { SubmitArcadeScoreInput } from "@/lib/validations/game";

export type GameQuestionWithMeta = GameQuestion & {
  isTruth?: boolean;
};

type UseQuestionsResult = {
  questions: GameQuestionWithMeta[];
  total: number;
};

export function useQuestions(type: GameType, count: number = 10, exclude?: string[]) {
  return useQuery({
    queryKey: queryKeys.games.questions(type, count, exclude),
    queryFn: async () => {
      const params = new URLSearchParams({ type, random: String(count) });
      if (exclude && exclude.length > 0) params.set("exclude", exclude.join(","));
      const res = await fetch(`/api/games/questions?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Gagal memuat pertanyaan (${res.status})`);
      return {
        questions: (json.data ?? []) as GameQuestionWithMeta[],
        total: (json.total as number) ?? 0,
      } satisfies UseQuestionsResult;
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
}

export function useAllQuestions(type: GameType) {
  return useQuery({
    queryKey: queryKeys.games.questions(type),
    queryFn: async () => {
      return fetchJsonList<GameQuestionWithMeta>(`/api/games/questions?type=${type}`);
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
}

export function useSubmitScore() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questionId,
      isCorrect,
      playerName,
    }: {
      questionId: string;
      isCorrect: boolean;
      playerName?: string;
    }) => {
      const res = await fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, isCorrect, playerName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim skor");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.games.leaderboard() });
      qc.invalidateQueries({ queryKey: queryKeys.games.arcadeLeaderboardPrefix });
    },
  });
}

export function useSubmitArcadeScore() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: SubmitArcadeScoreInput) => {
      const res = await fetch("/api/games/arcade-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim skor");
      return json.data;
    },
    onSuccess: () => {
      // Invalidate by prefix so every per-type arcade leaderboard refreshes.
      qc.invalidateQueries({ queryKey: queryKeys.games.arcadeLeaderboardPrefix });
    },
  });
}
