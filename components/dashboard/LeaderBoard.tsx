"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { motion } from "framer-motion";
import { Trophy, Medal, Target, Gamepad2, Cherry, Sparkles } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";

type LeaderboardEntry = {
  user: { id: string; name: string | null; image: string | null } | null;
  playerName: string | null;
  totalPlayed: number;
  totalCorrect: number;
  accuracy: number;
};

const GAME_TABS = [
  { label: "Semua", value: null },
  { label: "Would You Rather", value: "WOULD_YOU_RATHER" },
  { label: "Love Quiz", value: "TRIVIA" },
] as const;

export default function LeaderBoard() {
  const [gameType, setGameType] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.games.leaderboard(), gameType],
    queryFn: async () => {
      try {
        const params = gameType ? `?type=${gameType}` : "";
        const res = await fetch(`/api/games/leaderboard${params}`);
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json?.data) ? (json.data as LeaderboardEntry[]) : [];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
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
            Mainkan games untuk melihat leaderboard
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
      {data.map((entry, i) => {
        const isFirst = i === 0;
        const isSecond = i === 1;

        return (
          <motion.div
            key={entry.user?.id || entry.playerName || `guest-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
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
                ) : isSecond ? (
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
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Target className="h-3 w-3 shrink-0" />
                    {entry.totalCorrect}/{entry.totalPlayed} benar
                  </span>
                  <span className="shrink-0">Akurasi {entry.accuracy}%</span>
                </div>
              </div>

              {isFirst && (
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold text-yellow-600 dark:text-yellow-400 sm:text-lg">
                    {entry.accuracy}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">akurasi</p>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
