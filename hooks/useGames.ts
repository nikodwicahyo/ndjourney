"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { GameQuestion, GameType } from "@/types";

export type GameQuestionWithMeta = GameQuestion & {
  isTruth?: boolean;
};

export function useQuestions(type: GameType, count: number = 10) {
  return useQuery({
    queryKey: queryKeys.games.questions(type, count),
    queryFn: async () => {
      const res = await fetch(
        `/api/games/questions?type=${type}&random=${count}`,
      );
      const json = await res.json();
      return json.data as GameQuestionWithMeta[];
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
}

export function useAllQuestions(type: GameType) {
  return useQuery({
    queryKey: queryKeys.games.questions(type),
    queryFn: async () => {
      const res = await fetch(`/api/games/questions?type=${type}`);
      const json = await res.json();
      return json.data as GameQuestionWithMeta[];
    },
    staleTime: 600_000,
    gcTime: 600_000,
  });
}

export function useSubmitScore() {
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
      if (!res.ok) throw new Error(json.error || "Failed to submit score");
      return json.data;
    },
  });
}
