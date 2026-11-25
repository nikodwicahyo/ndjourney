"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton, Avatar, AvatarImage, AvatarFallback, Button } from "@/components/ui";
import { motion } from "framer-motion";
import { Trophy, Medal, Target, Gamepad2, Star, Brain, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { showDeleteConfirm } from "@/lib/swal";

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

// Explicit locale: bare toLocaleString() differs between the server (en-ID)
// and en-US browsers, which breaks hydration on prefetched leaderboards.
const formatScore = (value: number) => value.toLocaleString("id-ID");

async function fetchLeaderboard(type: string | null): Promise<LeaderEntry[]> {
  const params = type ? `?type=${type}` : "";
  const res = await fetch(`/api/games/leaderboard${params}`);
  // A failed request is NOT an empty board — never let it render "Belum ada skor".
  if (!res.ok) throw new Error("Gagal memuat leaderboard");
  const json = await res.json();
  return Array.isArray(json?.data) ? (json.data as LeaderEntry[]) : [];
}

type HiddenPlayer = {
  /** `user:<id>` or `guest:<lowercased name>`. */
  playerKey: string;
  label: string;
  hiddenAt: string;
};

async function fetchHiddenPlayers(): Promise<HiddenPlayer[]> {
  const res = await fetch("/api/games/leaderboard/hidden");
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.data) ? (json.data as HiddenPlayer[]) : [];
}

/**
 * Hiding is moderation, not deletion: the ledger rows stay untouched and the
 * aggregate just stops listing the player, so it is reversible. The account id
 * wins over a display name, so a signed-in player stays hidden whatever name
 * they typed.
 */
async function hidePlayer(entry: LeaderEntry): Promise<void> {
  const identity = entry.user?.id
    ? { userId: entry.user.id }
    : { playerName: entry.playerName };
  const res = await fetch("/api/games/leaderboard/hidden", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(identity),
  });
  if (!res.ok) throw new Error("Gagal menyembunyikan pemain");
}

async function unhidePlayer(playerKey: string): Promise<void> {
  const res = await fetch("/api/games/leaderboard/hidden", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerKey }),
  });
  if (!res.ok) throw new Error("Gagal memulihkan pemain");
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
              {formatScore(game.score)}
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

function HiddenPlayersPanel({
  hidden,
  restoring,
  onRestore,
}: {
  hidden: HiddenPlayer[];
  restoring: boolean;
  onRestore: (player: HiddenPlayer) => void;
}) {
  return (
    <details className="rounded-2xl border border-border bg-card px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">
        Pemain tersembunyi ({hidden.length})
      </summary>
      <ul className="mt-3 space-y-2">
        {hidden.map((player) => (
          <li key={player.playerKey} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm">{player.label}</span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={restoring}
              onClick={() => onRestore(player)}
              aria-label={`Pulihkan ${player.label} ke leaderboard`}
            >
              <Eye />
              Pulihkan
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function LeaderBoard({ canModerate = false }: { canModerate?: boolean }) {
  const [gameType, setGameType] = useState<string | null>(null);
  const activeTab = GAME_TABS.find((t) => t.value === gameType) ?? GAME_TABS[0];
  const isArcade = activeTab.type === "arcade";
  const isAll = activeTab.type === "all";

  // One server-aggregated source for every tab: the SQL layer knows the real
  // play counts, so the client never merges or recomputes them.
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.games.leaderboard(gameType),
    queryFn: () => fetchLeaderboard(gameType),
    staleTime: 30_000,
  });

  // Moderation data is only fetched where the UI can act on it. The public
  // board renders no controls at all; the API enforces authz regardless.
  const { data: hidden = [] } = useQuery({
    queryKey: queryKeys.games.hiddenPlayers,
    queryFn: fetchHiddenPlayers,
    enabled: canModerate,
    staleTime: 30_000,
  });

  const queryClient = useQueryClient();

  const refreshBoards = () => {
    // Hidden players change every tab, including the arcade stats panel.
    queryClient.invalidateQueries({ queryKey: queryKeys.games.leaderboardPrefix });
    queryClient.invalidateQueries({ queryKey: queryKeys.games.arcadeLeaderboardPrefix });
    queryClient.invalidateQueries({ queryKey: queryKeys.games.hiddenPlayers });
  };

  const hideMutation = useMutation({
    mutationFn: hidePlayer,
    onSuccess: (_result, entry) => {
      toast.success(`${playerName(entry)} disembunyikan dari leaderboard`);
      refreshBoards();
    },
    onError: () => toast.error("Gagal menyembunyikan pemain"),
  });

  const unhideMutation = useMutation({
    mutationFn: unhidePlayer,
    onSuccess: () => {
      toast.success("Pemain dipulihkan ke leaderboard");
      refreshBoards();
    },
    onError: () => toast.error("Gagal memulihkan pemain"),
  });

  async function confirmHide(entry: LeaderEntry) {
    const name = playerName(entry);
    const confirmed = await showDeleteConfirm({
      title: "Sembunyikan pemain?",
      text: `${name} tidak akan muncul di leaderboard semua game. Skor dan riwayat tetap tersimpan dan bisa dipulihkan kapan saja.`,
      confirmText: "Ya, sembunyikan",
      cancelText: "Batal",
    });
    if (confirmed) hideMutation.mutate(entry);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-hidden">
      <GameTabs value={gameType} onChange={setGameType} />

      {canModerate && hidden.length > 0 && (
        <HiddenPlayersPanel
          hidden={hidden}
          restoring={unhideMutation.isPending}
          onRestore={(player) => unhideMutation.mutate(player.playerKey)}
        />
      )}

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Gamepad2 className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Leaderboard belum bisa dimuat</p>
            <p className="mt-1 text-sm text-muted-foreground">Coba lagi setelah beberapa saat.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        data.length === 0 && (
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
        )
      )}

      {data.map((entry, i) => {
        const isFirst = i === 0;
        const hideable = !!entry.user?.id || !!entry.playerName;
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
                      {formatScore(entry.totalScore)} total
                    </span>
                  )}
                  {!isAll && isArcade && (
                    <span>Best: {formatScore(entry.bestScore ?? 0)} poin</span>
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
                    ? formatScore(entry.totalScore)
                    : `${entry.accuracy ?? 0}%`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAll || isArcade ? "Total Skor" : "Akurasi"}
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

            {canModerate && hideable && (
              // Footer action after all card content: full-width on phones,
              // right-aligned once the card has room.
              <div className="mt-3 flex border-t border-border/60 pt-3 sm:justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-muted-foreground hover:text-destructive sm:w-auto"
                  disabled={hideMutation.isPending}
                  onClick={() => confirmHide(entry)}
                  aria-label={`Sembunyikan ${playerName(entry)} dari leaderboard`}
                >
                  <EyeOff />
                  Sembunyikan pemain
                </Button>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
