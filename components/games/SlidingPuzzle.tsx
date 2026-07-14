"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSubmitArcadeScore } from "@/hooks/useGames";
import { Button, Skeleton } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  Grid3x3,
  Heart,
  RotateCcw,
  Trophy,
  ArrowLeft,
  ImageIcon,
  Timer,
  Move,
  Eye,
  CheckCircle2,
} from "lucide-react";
import type { Photo } from "@/types";

type Difficulty = 3 | 4 | 5;

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; maxMoves: number; maxTime: number }
> = {
  3: { label: "3\xd73 Mudah", maxMoves: 25, maxTime: 120 },
  4: { label: "4\xd74 Sedang", maxMoves: 60, maxTime: 300 },
  5: { label: "5\xd75 Sulit", maxMoves: 120, maxTime: 600 },
};

const LS_KEY = "swap-puzzle-best";

function loadBestTimes(): Record<
  string,
  { moves: number; time: number; score: number }
> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveBestTimes(
  times: Record<string, { moves: number; time: number; score: number }>,
) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(times));
  } catch {}
}

function shuffleTiles(gridSize: number): number[] {
  const total = gridSize * gridSize;
  const tiles = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  if (tiles.every((t, i) => t === i)) {
    [tiles[0], tiles[1]] = [tiles[1], tiles[0]];
  }
  return tiles;
}

function calculateScore(
  difficulty: Difficulty,
  moves: number,
  timeSec: number,
): number {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const difficultyWeight = { 3: 1, 4: 2, 5: 3 }[difficulty];
  const baseScore = difficultyWeight * 200;
  const movePenalty = Math.round((moves / cfg.maxMoves) * 100);
  const timePenalty = Math.round((timeSec / cfg.maxTime) * 100);
  return Math.max(1, baseScore - movePenalty - timePenalty);
}

function bgPos(col: number, row: number, gridSize: number): string {
  const divisor = gridSize - 1;
  const x = divisor > 0 ? (col / divisor) * 100 : 0;
  const y = divisor > 0 ? (row / divisor) * 100 : 0;
  return `${x}% ${y}%`;
}

type SlidingPuzzleProps = {
  playerName?: string;
};

type Phase = "pick" | "difficulty" | "play" | "complete" | "failed";

export default function SlidingPuzzle({ playerName }: SlidingPuzzleProps) {
  const submitScore = useSubmitArcadeScore();
  const [phase, setPhase] = useState<Phase>("pick");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [tiles, setTiles] = useState<number[]>([]);
  const [moveCount, setMoveCount] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [swappingPair, setSwappingPair] = useState<[number, number] | null>(
    null,
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bestTimes = useRef<
    Record<string, { moves: number; time: number; score: number }>
  >(loadBestTimes());

  const gridSize = difficulty;
  const maxMoves = DIFFICULTY_CONFIG[difficulty].maxMoves;
  const remainingMoves = maxMoves - moveCount;
  const isLowMoves = remainingMoves <= Math.ceil(maxMoves * 0.2);

  const { data: photosData, isLoading: photosLoading } = useQuery({
    queryKey: ["photos", "list", { mediaType: "foto" }],
    queryFn: async () => {
      const res = await fetch("/api/photos?limit=100&mediaType=foto");
      const json = await res.json();
      return (json.data ?? []) as Photo[];
    },
    staleTime: 60_000,
  });

  const photoUrl = selectedPhoto?.thumbnailUrl || selectedPhoto?.url || "";

  const startSamePuzzle = useCallback(() => {
    const shuffled = shuffleTiles(gridSize);
    setTiles(shuffled);
    setMoveCount(0);
    setTimeElapsed(0);
    setIsComplete(false);
    setSubmitted(false);
    setIsLocked(false);
    setSelectedIndex(null);
    setSwappingPair(null);
    setTimerKey((k) => k + 1);
    setPhase("play");
  }, [gridSize]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (phase === "play" && !isComplete) {
      timerRef.current = setInterval(() => {
        setTimeElapsed((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, isComplete, timerKey]);

  const handleTileClick = useCallback(
    (index: number) => {
      if (isLocked || isComplete || moveCount >= maxMoves) return;

      if (selectedIndex === null) {
        setSelectedIndex(index);
        return;
      }

      if (selectedIndex === index) {
        setSelectedIndex(null);
        return;
      }

      const a = selectedIndex;
      const b = index;
      setSwappingPair([a, b]);
      setSelectedIndex(null);
      setIsLocked(true);
      setMoveCount((m) => m + 1);

      setTimeout(() => {
        const newTiles = [...tiles];
        [newTiles[a], newTiles[b]] = [newTiles[b], newTiles[a]];
        const won = newTiles.every((t, i) => t === i);

        setTiles(newTiles);
        setSwappingPair(null);
        setIsLocked(false);

        if (won) {
          setIsComplete(true);
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeout(() => setPhase("complete"), 800);
        } else if (moveCount + 1 >= maxMoves) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase("failed");
        }
      }, 200);
    },
    [selectedIndex, isLocked, isComplete, moveCount, maxMoves, tiles],
  );

  useEffect(() => {
    if (isComplete && !submitted && selectedPhoto) {
      const finalTime = timeElapsed;
      const finalScore = calculateScore(difficulty, moveCount, finalTime);
      setSubmitted(true);

      const key = `${selectedPhoto.id}-${difficulty}`;
      const prev = bestTimes.current[key];
      if (!prev || finalScore > prev.score) {
        bestTimes.current[key] = {
          moves: moveCount,
          time: finalTime,
          score: finalScore,
        };
        saveBestTimes(bestTimes.current);
      }

      submitScore.mutate({
        gameType: "SLIDING_PUZZLE",
        score: finalScore,
        metadata: { moves: moveCount, time: finalTime, difficulty },
        playerName,
      });
    }
  }, [
    isComplete,
    submitted,
    selectedPhoto,
    difficulty,
    moveCount,
    timeElapsed,
    submitScore,
    playerName,
  ]);

  const tileSizePct = 100 / gridSize;

  if (phase === "pick") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Grid3x3 className="h-5 w-5 text-pink-500" />
            <h2 className="font-heading text-xl font-semibold">Pilih Foto</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Pilih foto couple untuk dijadikan puzzle
          </p>
        </div>

        {photosLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : !photosData || photosData.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-medium">Belum ada foto</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload foto ke galeri dulu untuk bermain puzzle
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photosData.map((photo) => (
              <button
                key={photo.id}
                onClick={() => {
                  setSelectedPhoto(photo);
                  setPhase("difficulty");
                }}
                className="group relative aspect-square overflow-hidden rounded-xl border-2 border-border bg-muted transition-all hover:border-pink-400 hover:shadow-md"
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt={photo.caption || "Foto"}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                  <Heart className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (phase === "difficulty") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="mb-6">
          <h2 className="font-heading text-xl font-semibold">
            Pilih Tingkat Kesulitan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Semakin sulit, semakin tinggi skor maksimal
          </p>
        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border-2 border-border">
          <img
            src={photoUrl}
            alt="Preview"
            className="h-48 w-full object-cover"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([3, 4, 5] as Difficulty[]).map((d) => {
            const cfg = DIFFICULTY_CONFIG[d];
            const best = selectedPhoto
              ? bestTimes.current[`${selectedPhoto.id}-${d}`]
              : null;
            return (
              <button
                key={d}
                onClick={() => {
                  setDifficulty(d);
                  if (selectedPhoto) {
                    const shuffled = shuffleTiles(d);
                    setTiles(shuffled);
                    setMoveCount(0);
                    setTimeElapsed(0);
                    setIsComplete(false);
                    setSubmitted(false);
                    setIsLocked(false);
                    setSelectedIndex(null);
                    setSwappingPair(null);
                    setTimerKey((k) => k + 1);
                    setPhase("play");
                  }
                }}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-5 transition-all hover:border-pink-400 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/10">
                  <Grid3x3 className="h-5 w-5 text-pink-500" />
                </div>
                <span className="font-heading font-semibold">{cfg.label}</span>
                <span className="text-xs text-muted-foreground">
                  Maks {cfg.maxMoves} langkah
                </span>
                {best && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">
                    🏆 Terbaik: {best.moves} langkah · {formatTime(best.time)} · {best.score} poin
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          onClick={() => setPhase("pick")}
          className="mt-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Ganti Foto
        </Button>
      </div>
    );
  }

  if (phase === "complete") {
    const finalScore = calculateScore(difficulty, moveCount, timeElapsed);
    const key = selectedPhoto ? `${selectedPhoto.id}-${difficulty}` : "";
    const best = bestTimes.current[key];

    return (
      <div className="mx-auto max-w-lg text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="mb-6 flex justify-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/10">
            <Trophy className="h-10 w-10 text-yellow-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-heading text-2xl font-semibold">
            Puzzle Selesai! 🎉
          </h2>
          <p className="mt-2 text-muted-foreground">
            {DIFFICULTY_CONFIG[difficulty].label}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <div className="mb-4 overflow-hidden rounded-2xl border-2 border-border">
            <img
              src={photoUrl}
              alt="Selesai"
              className="h-48 w-full object-cover"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <Move className="mx-auto mb-1 h-5 w-5 text-pink-500" />
              <p className="text-lg font-bold">{moveCount}</p>
              <p className="text-xs text-muted-foreground">Langkah</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <Timer className="mx-auto mb-1 h-5 w-5 text-pink-500" />
              <p className="text-lg font-bold">{formatTime(timeElapsed)}</p>
              <p className="text-xs text-muted-foreground">Waktu</p>
            </div>
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4">
              <Trophy className="mx-auto mb-1 h-5 w-5 text-yellow-500" />
              <p className="text-lg font-bold">{finalScore}</p>
              <p className="text-xs text-muted-foreground">Skor</p>
            </div>
          </div>
        </motion.div>

        {best && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-4 text-sm text-yellow-600 dark:text-yellow-400"
          >
            🏆 Skor terbaik: {best.score} poin ({best.moves} langkah,{" "}
            {formatTime(best.time)})
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
        >
          <Button onClick={startSamePuzzle} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Main Lagi
          </Button>
          <Button
            variant="outline"
            onClick={() => setPhase("difficulty")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Ganti Kesulitan
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedPhoto(null);
              setPhase("pick");
            }}
            className="gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            Ganti Foto
          </Button>
        </motion.div>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="mb-6 flex justify-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
            <span className="text-3xl">😵</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-heading text-2xl font-semibold">Gagal!</h2>
          <p className="mt-2 text-muted-foreground">
            Batas {DIFFICULTY_CONFIG[difficulty].maxMoves} langkah tercapai
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <div className="mb-4 overflow-hidden rounded-2xl border-2 border-border opacity-60">
            <img
              src={photoUrl}
              alt="Gagal"
              className="h-48 w-full object-cover"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <Move className="mx-auto mb-1 h-5 w-5 text-pink-500" />
              <p className="text-lg font-bold">{moveCount}</p>
              <p className="text-xs text-muted-foreground">Langkah</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <Timer className="mx-auto mb-1 h-5 w-5 text-pink-500" />
              <p className="text-lg font-bold">{formatTime(timeElapsed)}</p>
              <p className="text-xs text-muted-foreground">Waktu</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
        >
          <Button onClick={startSamePuzzle} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Coba Lagi
          </Button>
          <Button
            variant="outline"
            onClick={() => setPhase("difficulty")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Ganti Kesulitan
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedPhoto(null);
              setPhase("pick");
            }}
            className="gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            Ganti Foto
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border shadow-sm transition-transform hover:scale-105"
            title="Lihat foto target"
          >
            <img
              src={photoUrl}
              alt="Target"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
              <Eye className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </button>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Move className="h-3.5 w-3.5 text-pink-500" />
              <span className="font-mono font-semibold tabular-nums">
                {moveCount}
              </span>
            </span>
            <span
              className={`inline-flex items-center gap-1 font-mono text-xs ${
                isLowMoves
                  ? "font-bold text-red-500"
                  : remainingMoves <= Math.ceil(maxMoves * 0.5)
                    ? "text-amber-500"
                    : "text-muted-foreground"
              }`}
            >
              <span className="font-semibold">{remainingMoves}</span>
              <span className="text-[10px]">sisa</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5 text-pink-500" />
              <span className="font-mono font-semibold tabular-nums">
                {formatTime(timeElapsed)}
              </span>
            </span>
          </div>
        </div>
        <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
          {DIFFICULTY_CONFIG[difficulty].label}
        </span>
      </div>

      <div
        className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border-2 border-border shadow-lg"
        style={{ touchAction: "manipulation", userSelect: "none" }}
      >
        {tiles.map((tileVal, i) => {
          const posLeft = `${(i % gridSize) * tileSizePct}%`;
          const posTop = `${Math.floor(i / gridSize) * tileSizePct}%`;
          const tileItemW = `${tileSizePct}%`;
          const tileItemH = `${tileSizePct}%`;

          const isSelected = i === selectedIndex;
          const isSwapping =
            swappingPair !== null &&
            (i === swappingPair[0] || i === swappingPair[1]);
          const isInPlace = tileVal === i;

          const origRow = Math.floor(tileVal / gridSize);
          const origCol = tileVal % gridSize;

          return (
            <button
              key={i}
              onClick={() => handleTileClick(i)}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleTileClick(i);
              }}
              disabled={isLocked || isComplete}
              className="absolute shadow-sm disabled:opacity-100"
              style={{
                width: tileItemW,
                height: tileItemH,
                left: posLeft,
                top: posTop,
                backgroundImage: `url(${photoUrl})`,
                backgroundSize: `${gridSize * 100}%`,
                backgroundPosition: bgPos(origCol, origRow, gridSize),
                transition: isSwapping
                  ? "none"
                  : "transform 150ms ease, box-shadow 150ms ease",
                WebkitTapHighlightColor: "transparent",
                borderRight: "0.5px solid rgba(0,0,0,0.06)",
                borderBottom: "0.5px solid rgba(0,0,0,0.06)",
                transform: isSwapping ? "scale(0.85)" : isSelected ? "scale(0.92)" : "scale(1)",
                boxShadow: isSelected
                  ? "inset 0 0 0 3px rgba(236,72,153,0.7), 0 2px 12px rgba(236,72,153,0.3)"
                  : isInPlace && !isLocked
                    ? "inset 0 0 0 1.5px rgba(34,197,94,0.4)"
                    : "none",
                zIndex: isSelected || isSwapping ? 10 : 1,
                cursor: isLocked || isComplete ? "default" : "pointer",
              }}
            >
              {isSelected && (
                <div className="pointer-events-none absolute -inset-0.5 z-0 rounded-[inherit] border-2 border-pink-400" />
              )}
              <AnimatePresence>
                {isInPlace && !isLocked && !isSelected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-0.5 right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-green-500/70"
                  >
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-center text-xs text-muted-foreground">
        {selectedIndex !== null
          ? "Pilih kotak lain untuk ditukar"
          : "Klik dua kotak untuk menukar posisinya"}
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={startSamePuzzle}
          className="gap-1.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Acak Ulang
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPhase("difficulty")}
          className="gap-1.5 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Ganti Kesulitan
        </Button>
      </div>

      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPreview(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            >
              <img
                src={photoUrl}
                alt="Preview"
                className="aspect-square w-full object-cover"
              />
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Klik di luar gambar untuk menutup
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
