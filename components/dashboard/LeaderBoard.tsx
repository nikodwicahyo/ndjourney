"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { motion } from "framer-motion";
import { Trophy, Medal, Target, Gamepad2, Star, Brain } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";

const ARCADE_TYPES = ["SLIDING_PUZZLE", "LOVE_DARTS"];

type LeaderEntry = {
  user: { id: string; name: string | null; image: string | null } | null;
  playerName: string | null;
  totalPlayed: number;
  totalCorrect?: number;
  accuracy?: number;
  totalScore?: number;
  bestScore?: number;
  avgScore?: number;
  _gameLabel?: string;
  _isArcade?: boolean;
  _hasArcade?: boolean;
  _hasQa?: boolean;
  _qaPlayed?: number;
};

type TabEntry = {
  label: string;
  value: string | null;
  type: "qa" | "arcade" | "all";
};

const ARCADE_LABELS: Record<string, string> = {
  SLIDING_PUZZLE: "Puzzle",
  LOVE_DARTS: "Darts",
};

const GAME_TABS: TabEntry[] = [
  { label: "Semua", value: null, type: "all" },
  { label: "Would You Rather", value: "WOULD_YOU_RATHER", type: "qa" },
  { label: "Love Quiz", value: "TRIVIA", type: "qa" },
  { label: "Puzzle", value: "SLIDING_PUZZLE", type: "arcade" },
  { label: "Darts", value: "LOVE_DARTS", type: "arcade" },
];

async function fetchLeaderboard(
  endpoint: string,
  label?: string,
  isArcade?: boolean,
): Promise<LeaderEntry[]> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return [];
    const json = await res.json();
    const data = Array.isArray(json?.data) ? (json.data as LeaderEntry[]) : [];
    if (label) {
      data.forEach((e) => {
        e._gameLabel = label;
        e._isArcade = isArcade;
      });
    }
    return data;
  } catch {
    return [];
  }
}

export default function LeaderBoard() {
  const [gameType, setGameType] = useState<string | null>(null);
  const activeTab = GAME_TABS.find(t => t.value === gameType) ?? GAME_TABS[0];
  const isArcade = activeTab.type === "arcade";
  const isAll = activeTab.type === "all";

  const qk = (isArcade
    ? [...queryKeys.games.arcadeLeaderboard(gameType ?? undefined)]
    : [...queryKeys.games.leaderboard(), gameType]) as unknown as readonly unknown[];

  const qaQuery = useQuery({
    queryKey: [...queryKeys.games.leaderboard(), gameType],
    queryFn: (): Promise<LeaderEntry[]> => {
      const params = gameType ? `?type=${gameType}` : "";
      return fetchLeaderboard(`/api/games/leaderboard${params}`);
    },
    staleTime: 30_000,
    enabled: !isArcade,
  });

  const arcadeQuery = useQuery({
    queryKey: queryKeys.games.arcadeLeaderboard(gameType ?? undefined),
    queryFn: (): Promise<LeaderEntry[]> =>
      fetchLeaderboard(
        `/api/games/arcade-leaderboard?type=${gameType}`,
        ARCADE_LABELS[gameType ?? ""],
        true,
      ),
    staleTime: 30_000,
    enabled: isArcade && !isAll,
  });

  const allQa = useQuery({
    queryKey: ["leaderboard", "all-qa"],
    queryFn: (): Promise<LeaderEntry[]> =>
      fetchLeaderboard("/api/games/leaderboard"),
    staleTime: 30_000,
    enabled: isAll,
  });

  const allSwap = useQuery({
    queryKey: queryKeys.games.arcadeLeaderboard("SLIDING_PUZZLE"),
    queryFn: (): Promise<LeaderEntry[]> =>
      fetchLeaderboard(
        "/api/games/arcade-leaderboard?type=SLIDING_PUZZLE",
        "Puzzle",
        true,
      ),
    staleTime: 30_000,
    enabled: isAll,
  });

  const allDarts = useQuery({
    queryKey: queryKeys.games.arcadeLeaderboard("LOVE_DARTS"),
    queryFn: (): Promise<LeaderEntry[]> =>
      fetchLeaderboard(
        "/api/games/arcade-leaderboard?type=LOVE_DARTS",
        "Darts",
        true,
      ),
    staleTime: 30_000,
    enabled: isAll,
  });

  const isLoading = isAll
    ? allQa.isLoading || allSwap.isLoading || allDarts.isLoading
    : isArcade
      ? arcadeQuery.isLoading
      : qaQuery.isLoading;

  const data = useMemo(() => {
    if (isAll) {
      const groups = new Map<string, LeaderEntry>();
      const keyOf = (e: LeaderEntry) => e.user?.id ?? `guest:${e.playerName ?? "anon"}`;

      const merge = (e: LeaderEntry, isArc: boolean) => {
        const k = keyOf(e);
        const existing = groups.get(k);
          if (existing) {
            existing.totalPlayed += e.totalPlayed;
            if (isArc) {
              existing.totalScore = (existing.totalScore ?? 0) + (e.totalScore ?? 0);
              existing.bestScore = Math.max(existing.bestScore ?? 0, e.bestScore ?? 0);
            } else {
              existing.totalCorrect = (existing.totalCorrect ?? 0) + (e.totalCorrect ?? 0);
              existing._qaPlayed = (existing._qaPlayed ?? 0) + e.totalPlayed;
            }
          } else {
            groups.set(k, {
              user: e.user,
              playerName: e.playerName,
              totalPlayed: e.totalPlayed,
              totalCorrect: isArc ? undefined : e.totalCorrect,
              accuracy: isArc ? undefined : e.accuracy,
              totalScore: isArc ? (e.totalScore ?? 0) : undefined,
              bestScore: isArc ? (e.bestScore ?? 0) : undefined,
              avgScore: isArc ? (e.avgScore ?? 0) : undefined,
              _isArcade: isArc,
              _hasArcade: isArc,
              _hasQa: !isArc,
              _qaPlayed: isArc ? 0 : e.totalPlayed,
            });
          }
          if (existing) {
            existing._hasArcade = (existing._hasArcade ?? false) || isArc;
            existing._hasQa = (existing._hasQa ?? false) || !isArc;
          }
      };

      (allQa.data ?? []).forEach((e) => merge(e, false));
      (allSwap.data ?? []).forEach((e) => merge(e, true));
      (allDarts.data ?? []).forEach((e) => merge(e, true));

      const result = Array.from(groups.values());
      result.forEach((e) => {
        if (e.totalCorrect != null && (e._qaPlayed ?? 0) > 0) {
          e.accuracy = Math.round((e.totalCorrect / (e._qaPlayed ?? 1)) * 100);
        }
      });
      return result.sort((a, b) => (b.totalPlayed ?? 0) - (a.totalPlayed ?? 0));
    }
    if (isArcade) return arcadeQuery.data ?? [];
    return qaQuery.data ?? [];
  }, [isAll, isArcade, allQa.data, allSwap.data, allDarts.data, arcadeQuery.data, qaQuery.data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Gamepad2 className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Belum ada skor</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAll ? "Mainkan games untuk melihat leaderboard" : isArcade ? "Mainkan game ini untuk melihat leaderboard" : "Mainkan games untuk melihat leaderboard"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {GAME_TABS.map((tab) => (
          <button
            key={tab.value ?? "all"}
            onClick={() => setGameType(tab.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              gameType === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {(data as LeaderEntry[]).map((entry, i) => {
        const isFirst = i === 0;

        if (isAll) {
          return (
            <motion.div
              key={`${entry.user?.id || entry.playerName || "guest"}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`rounded-2xl border p-4 overflow-hidden ${
                isFirst
                  ? "border-yellow-500/30 bg-yellow-500/[0.03]"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center text-xs font-bold sm:h-10 sm:w-10 sm:text-sm">
                  {isFirst ? (
                    <Trophy className="h-6 w-6 text-yellow-500 sm:h-7 sm:w-7" />
                  ) : i === 1 ? (
                    <Medal className="h-6 w-6 text-gray-400 sm:h-7 sm:w-7" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground sm:h-8 sm:w-8">
                      {i + 1}
                    </div>
                  )}
                </div>
                <Avatar className="h-8 w-8 shrink-0 sm:h-10 sm:w-10">
                  <AvatarImage src={entry.user?.image ?? undefined} alt={entry.playerName ?? entry.user?.name ?? "Player"} />
                  <AvatarFallback>{(entry.playerName ?? entry.user?.name ?? "P").charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-sm sm:text-base">
                      {entry.playerName || entry.user?.name || "Pasangan"}
                    </span>
                    {isFirst && (
                      <span className="shrink-0 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">
                        Peringkat 1
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                      <Gamepad2 className="h-3 w-3" />
                      {entry.totalPlayed}x main
                    </span>
                  </div>
                </div>
                {isFirst && (
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-yellow-600 dark:text-yellow-400 sm:text-lg">
                      {entry.totalPlayed}x
                    </p>
                    <p className="text-[10px] text-muted-foreground">total main</p>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {entry._hasQa && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Brain className="h-3 w-3 text-blue-500" />
                      Quiz (Would You Rather & Love Quiz)
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        {entry.totalCorrect ?? 0}/{entry._qaPlayed ?? 0}
                      </span>{" "}
                      benar ·{" "}
                      <span className="font-medium text-blue-500">
                        {entry.accuracy ?? 0}%
                      </span>{" "}
                      akurasi
                    </div>
                  </div>
                )}
                {entry._hasArcade && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Star className="h-3 w-3 text-yellow-500" />
                      Arcade (Puzzle & Darts)
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        {entry.totalScore?.toLocaleString() ?? 0}
                      </span>{" "}
                      total skor · Best{" "}
                      <span className="font-medium text-foreground/80">
                        {entry.bestScore?.toLocaleString() ?? 0}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={`${entry.user?.id || entry.playerName || "guest"}-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border p-4 overflow-hidden ${
              isFirst
                ? "border-yellow-500/30 bg-yellow-500/[0.03]"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-12 sm:w-12">
                {isFirst ? (
                  <Trophy className="h-7 w-7 text-yellow-500 sm:h-8 sm:w-8" />
                ) : i === 1 ? (
                  <Medal className="h-7 w-7 text-gray-400 sm:h-8 sm:w-8" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground sm:h-8 sm:w-8 sm:text-sm">
                    {i + 1}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-2 truncate font-medium text-sm sm:text-base">
                  <Avatar className="h-6 w-6 inline-flex shrink-0 mr-2">
                    <AvatarImage src={entry.user?.image ?? undefined} alt={entry.user?.name ?? entry.playerName ?? "Player"} />
                    <AvatarFallback>{(entry.user?.name ?? entry.playerName ?? "P").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{entry.playerName || entry.user?.name || "Pasangan"}</span>
                  {isFirst && (
                    <span className="ml-1.5 text-[11px] text-yellow-600 dark:text-yellow-400 sm:ml-2 sm:text-xs shrink-0">
                      Peringkat 1
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                  {isArcade ? (
                    <>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <Star className="h-3 w-3 shrink-0 text-yellow-500" />
                        {entry.totalScore?.toLocaleString() ?? 0} total
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <Target className="h-3 w-3 shrink-0" />
                        {entry.totalPlayed}x main
                      </span>
                      <span className="shrink-0">
                        Best: {entry.bestScore?.toLocaleString() ?? 0} poin
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <Target className="h-3 w-3 shrink-0" />
                        {entry.totalCorrect ?? 0}/{entry.totalPlayed} benar
                      </span>
                      <span className="shrink-0">Akurasi {entry.accuracy ?? 0}%</span>
                    </>
                  )}
                </div>
              </div>

              {isFirst && (
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold text-yellow-600 dark:text-yellow-400 sm:text-lg">
                    {isArcade ? (entry.totalScore?.toLocaleString() ?? "0") : `${entry.accuracy ?? 0}%`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isArcade ? "total skor" : "akurasi"}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
