"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { motion } from "framer-motion";
import { Trophy, Medal, Target, Gamepad2, Star, Brain } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";

type GameBreakdown = {
  type: string;
  plays: number;
  score: number;
  correct?: number;
  answered?: number;
  accuracy?: number;
};

type LeaderEntry = {
  user: { id: string; name: string | null; image: string | null } | null;
  playerName: string | null;
  /** Completed rounds (quiz) or finished runs (arcade). */
  totalPlayed: number;
  /** Ranking score: quiz correct × 1000 + arcade points. */
  totalScore: number;
  totalCorrect?: number;
  totalAnswered?: number;
  accuracy?: number;
  bestScore?: number;
  games?: GameBreakdown[];
};

type TabEntry = {
  label: string;
  value: string | null;
  type: "qa" | "arcade" | "all";
};

const GAME_TABS: TabEntry[] = [
  { label: "Semua", value: null, type: "all" },
  { label: "Would You Rather", value: "WOULD_YOU_RATHER", type: "qa" },
  { label: "Love Quiz", value: "TRIVIA", type: "qa" },
  { label: "Puzzle", value: "SLIDING_PUZZLE", type: "arcade" },
  { label: "Block Blast", value: "MEMORY_BLOCK_BLAST", type: "arcade" },
];

const GAME_META: Record<string, { label: string; type: "qa" | "arcade" }> = {
  WOULD_YOU_RATHER: { label: "Would You Rather", type: "qa" },
  TRIVIA: { label: "Love Quiz", type: "qa" },
  SLIDING_PUZZLE: { label: "Puzzle", type: "arcade" },
  MEMORY_BLOCK_BLAST: { label: "Block Blast", type: "arcade" },
};

const GAME_ORDER = Object.keys(GAME_META);

async function fetchLeaderboard(type: string | null): Promise<LeaderEntry[]> {
  const params = type ? `?type=${type}` : "";
  const res = await fetch(`/api/games/leaderboard${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.data) ? (json.data as LeaderEntry[]) : [];
}

function playerName(entry: LeaderEntry): string {
  return entry.playerName || entry.user?.name || "Pasangan";
}

function RankBadge({ index }: { index: number }) {
  if (index === 0) return <Trophy className="h-6 w-6 text-yellow-500 sm:h-7 sm:w-7" aria-label="Peringkat 1" />;
  if (index === 1) return <Medal className="h-6 w-6 text-gray-400 sm:h-7 sm:w-7" aria-label="Peringkat 2" />;
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground sm:h-8 sm:w-8">
      {index + 1}
    </div>
  );
}

function BreakdownCard({ game }: { game: GameBreakdown }) {
  const meta = GAME_META[game.type];
  if (!meta) return null;
  const isQa = meta.type === "qa";
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {isQa ? (
          <Brain className="h-3 w-3 text-blue-600 dark:text-blue-400" />
        ) : (
          <Star className="h-3 w-3 text-yellow-500" />
        )}
        {meta.label}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{game.plays}x main</span>
        {" · "}
        {isQa ? (
          <>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {game.accuracy ?? 0}%
            </span>{" "}
            akurasi ({game.correct ?? 0}/{game.answered ?? 0})
          </>
        ) : (
          <>
            <span className="font-medium text-foreground/80">
              {game.score.toLocaleString()}
            </span>{" "}
            skor
          </>
        )}
      </div>
    </div>
  );
}

function GameTabs({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {GAME_TABS.map((tab) => (
        <button
          key={tab.value ?? "all"}
          type="button"
          onClick={() => onChange(tab.value)}
          aria-pressed={value === tab.value}
          className={`inline-flex h-10 shrink-0 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors ${
            value === tab.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function LeaderBoard() {
  const [gameType, setGameType] = useState<string | null>(null);
  const activeTab = GAME_TABS.find((t) => t.value === gameType) ?? GAME_TABS[0];
  const isArcade = activeTab.type === "arcade";
  const isAll = activeTab.type === "all";

  // One server-aggregated source for every tab: the SQL layer knows the real
  // play counts, so the client never merges or recomputes them.
  const { data = [], isLoading } = useQuery({
    queryKey: queryKeys.games.leaderboard(gameType),
    queryFn: () => fetchLeaderboard(gameType),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-3">
        <GameTabs value={gameType} onChange={setGameType} />
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Gamepad2 className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Belum ada skor</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAll
                ? "Mainkan games untuk melihat leaderboard"
                : "Mainkan game ini untuk melihat leaderboard"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-hidden">
      <GameTabs value={gameType} onChange={setGameType} />

      {data.map((entry, i) => {
        const isFirst = i === 0;
        const games = [...(entry.games ?? [])].sort(
          (a, b) => GAME_ORDER.indexOf(a.type) - GAME_ORDER.indexOf(b.type),
        );

        return (
          <motion.div
            key={`${entry.user?.id || entry.playerName || "guest"}-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="overflow-hidden rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10">
                <RankBadge index={i} />
              </div>
              <Avatar className="h-8 w-8 shrink-0 sm:h-10 sm:w-10">
                <AvatarImage
                  src={entry.user?.image ?? undefined}
                  alt={playerName(entry)}
                />
                <AvatarFallback>{playerName(entry).charAt(0)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold sm:text-base">
                    {playerName(entry)}
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
                  {!isAll && isArcade && (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      {entry.totalScore.toLocaleString()} total
                    </span>
                  )}
                  {!isAll && isArcade && (
                    <span>Best: {(entry.bestScore ?? 0).toLocaleString()} poin</span>
                  )}
                  {!isAll && !isArcade && (
                    <span className="inline-flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {entry.totalCorrect ?? 0}/{entry.totalAnswered ?? 0} benar
                    </span>
                  )}
                  {!isAll && !isArcade && (
                    <span>Akurasi {entry.accuracy ?? 0}%</span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className={`text-base font-bold sm:text-lg ${isFirst ? "text-yellow-600 dark:text-yellow-400" : "text-foreground"}`}>
                  {isAll || isArcade
                    ? entry.totalScore.toLocaleString()
                    : `${entry.accuracy ?? 0}%`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAll || isArcade ? "total skor" : "akurasi"}
                </p>
              </div>
            </div>

            {isAll && games.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {games.map((game) => (
                  <BreakdownCard key={game.type} game={game} />
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
