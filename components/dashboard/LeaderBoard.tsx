"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui";
import { motion } from "framer-motion";
import { Trophy, Medal, Target, Gamepad2 } from "lucide-react";

type LeaderboardEntry = {
  user: { id: string; name: string | null; image: string | null } | null;
  playerName: string | null;
  totalPlayed: number;
  totalCorrect: number;
  accuracy: number;
};

export default function LeaderBoard() {
  const { data, isLoading } = useQuery({
    queryKey: ["games", "leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/games/leaderboard");
      const json = await res.json();
      return json.data as LeaderboardEntry[];
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
                <p className="truncate font-medium text-sm sm:text-base">
                  {entry.playerName || entry.user?.name || "Pasangan"}
                  {isFirst && (
                    <span className="ml-1.5 text-[11px] text-yellow-600 dark:text-yellow-400 sm:ml-2 sm:text-xs">
                      Peringkat 1
                    </span>
                  )}
                </p>
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
