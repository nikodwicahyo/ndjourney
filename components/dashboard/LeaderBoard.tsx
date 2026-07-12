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
    <div className="space-y-3">
      {data.map((entry, i) => {
        const isFirst = i === 0;
        const isSecond = i === 1;

        return (
          <motion.div
            key={entry.user?.id || entry.playerName || `guest-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-2xl border p-4 ${
              isFirst
                ? "border-yellow-500/30 bg-yellow-500/[0.03]"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center">
                {isFirst ? (
                  <Trophy className="h-8 w-8 text-yellow-500" />
                ) : isSecond ? (
                  <Medal className="h-8 w-8 text-gray-400" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {entry.playerName || entry.user?.name || "Pasangan"}
                  {isFirst && (
                    <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                      Peringkat 1
                    </span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {entry.totalCorrect}/{entry.totalPlayed} benar
                  </span>
                  <span>Akurasi {entry.accuracy}%</span>
                </div>
              </div>

              {isFirst && (
                <div className="text-right">
                  <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
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
