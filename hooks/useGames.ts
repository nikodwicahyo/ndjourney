"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchJsonList } from "@/lib/fetch-json";
import type { GameQuestion, GameType } from "@/types";
import type { SubmitArcadeScoreInput } from "@/lib/validations/game";
import {
  appendSeen,
  deckStorageKey,
  loadSeenIds,
  saveSeenIds,
} from "@/lib/game-deck";

export type GameQuestionWithMeta = GameQuestion & {
  isTruth?: boolean;
};

type UseQuestionsResult = {
  questions: GameQuestionWithMeta[];
  total: number;
};

export function useQuestions(type: GameType, count: number = 10, exclude?: string[], cycle?: boolean, round?: number) {
  return useQuery({
    queryKey: queryKeys.games.questions(type, count, exclude, cycle ? "cycle" : "normal", round),
    queryFn: async () => {
      const params = new URLSearchParams({ type, random: String(count) });
      if (exclude && exclude.length > 0) params.set("exclude", exclude.join(","));
      if (cycle) params.set("cycle", "1");
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

// No-repeat session deck for batch quiz games (WouldYouRather, Trivia).
// Seen ids persist per game type (guests included — server only excludes
// logged-in userIds), accumulate synchronously via ref mirror so the very
// next fetch already carries them (no setState-then-refetch race), and the
// deck cycles explicitly with a notice instead of silently recycling.
export function useQuestionDeck(type: GameType, batchSize: number) {
  const storageKey = deckStorageKey(type);
  // fetchSeen is the frozen snapshot driving the query key — it only moves
  // on restart, so answering mid-round never triggers a mid-game refetch.
  const [fetchSeen, setFetchSeen] = useState<string[]>(() =>
    loadSeenIds(storageKey),
  );
  // Live set: every answered id joins immediately (persisted synchronously),
  // so quit-then-start excludes even mid-round answers.
  const seenRef = useRef<string[]>(fetchSeen);
  const [cycled, setCycled] = useState(false);
  // Once the player has exhausted the bank, stay in cycle mode: the client's
  // own seen-list drives no-repeat from here on, so the server must stop
  // excluding this user's historical answers. Flipping this back to `false`
  // after the cycle fetch resolved used to change the query key and trigger a
  // second, contradictory fetch.
  const [cycleMode, setCycleMode] = useState(false);
  const [round, setRound] = useState(0);

  const query = useQuestions(type, batchSize, fetchSeen, cycleMode, round);
  const batch = query.data?.questions ?? [];
  const total = query.data?.total ?? 0;

  // Bank exhausted for this player (server returned nothing but the bank is
  // non-empty): start a fresh cycle explicitly. Render-time adjustment on
  // state only — at empty-batch evaluation points (mount / post-restart
  // fetch) the live set always equals the frozen snapshot, so no ref reads
  // are needed. An empty bank (total 0) shows the empty state instead.
  // The key change (seen + round) makes React Query drop the old data, so this
  // cannot re-fire before the replacement fetch resolves.
  if (!query.isLoading && query.data && batch.length === 0 && total > 0) {
    setFetchSeen([]);
    setCycled(true);
    setCycleMode(true);
    setRound((r) => r + 1);
  }

  // Sync the live set + storage with the cycle reset (ref writes and
  // external writes belong in effects, never in render).
  useEffect(() => {
    if (cycled) {
      seenRef.current = [];
      saveSeenIds(storageKey, []);
    }
  }, [cycled, storageKey]);

  // Record one answered question. Returns true when it is a first attempt
  // (→ submit the score); false on repeats (true-exhaustion recycles →
  // skip the POST so the 409 path never surfaces). Never touches the
  // query key — safe to call mid-round.
  const markAnswered = useCallback(
    (questionId: string): boolean => {
      if (seenRef.current.includes(questionId)) return false;
      const next = appendSeen(seenRef.current, [questionId]);
      seenRef.current = next;
      saveSeenIds(storageKey, next);
      return true;
    },
    [storageKey],
  );

  // Start a fresh round: live set (incl. mid-round answers) plus the
  // current batch joins, then the snapshot moves — the key-change
  // auto-fetch excludes it all, with no manual refetch to race it.
  const restart = useCallback(
    (currentBatchIds: string[]) => {
      setCycled(false);
      setRound((r) => r + 1);
      const next = appendSeen(seenRef.current, currentBatchIds);
      seenRef.current = next;
      saveSeenIds(storageKey, next);
      setFetchSeen(next);
    },
    [storageKey],
  );

  return {
    batch,
    total,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    cycled,
    restart,
    markAnswered,
  };
}

export type SubmitScoreResult = {
  data: unknown;
  correct: boolean;
  answer: string | null;
};

export function useSubmitScore() {
  return useMutation({
    mutationFn: async ({
      questionId,
      selectedAnswer,
      playerName,
    }: {
      questionId: string;
      selectedAnswer: string;
      playerName?: string;
    }): Promise<SubmitScoreResult> => {
      const res = await fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, selectedAnswer, playerName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim skor");
      return json as SubmitScoreResult;
    },
    // No leaderboard invalidation: the board aggregates completed rounds
    // (/api/games/round), not individual answers.
  });
}

export type SubmitGameRoundResult = {
  id: string;
  gameType: string;
  correct: number;
  totalQuestions: number;
  playedAt: string;
};

/** Record one completed quiz round — the event the leaderboard counts. */
export function useSubmitGameRound() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      gameType,
      roundId,
      questionIds,
      playerName,
    }: {
      gameType: "WOULD_YOU_RATHER" | "TRIVIA";
      roundId: string;
      questionIds: string[];
      playerName?: string;
    }): Promise<SubmitGameRoundResult> => {
      const res = await fetch("/api/games/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType, roundId, questionIds, playerName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan babak");
      return json.data as SubmitGameRoundResult;
    },
    onSuccess: () => {
      // Every tab key is prefixed by ["games","leaderboard"].
      qc.invalidateQueries({ queryKey: queryKeys.games.leaderboardPrefix, refetchType: "all" });
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
      // Invalidate by prefix so every per-type arcade leaderboard refreshes,
      // and the merged "Semua" tab (served by /api/games/leaderboard) too.
      qc.invalidateQueries({ queryKey: queryKeys.games.arcadeLeaderboardPrefix });
      qc.invalidateQueries({ queryKey: queryKeys.games.leaderboardPrefix, refetchType: "all" });
    },
  });
}
