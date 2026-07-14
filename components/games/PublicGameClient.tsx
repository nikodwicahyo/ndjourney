"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import GameSelector from "./GameSelector";
import LeaderBoard from "@/components/dashboard/LeaderBoard";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Trophy, User, Grid3x3, Target } from "lucide-react";
import { Skeleton, Button } from "@/components/ui";
import type { GameType } from "@/types";
import { toast } from "sonner";

const WouldYouRather = dynamic(() => import("./WouldYouRather"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
});

const TriviaQuiz = dynamic(() => import("./TriviaQuiz"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
});

const SpinTheWheel = dynamic(() => import("./SpinTheWheel"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Skeleton className="h-64 w-64 rounded-full" />
    </div>
  ),
});

const TruthOrDare = dynamic(() => import("./TruthOrDare"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
});

const SlidingPuzzle = dynamic(() => import("./SlidingPuzzle"), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-2xl" />,
});

const LoveDarts = dynamic(() => import("./LoveDarts"), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-2xl" />,
});

const gameLabels: Record<GameType, string> = {
  WOULD_YOU_RATHER: "Would You Rather?",
  TRIVIA: "Love Quiz",
  SPIN_THE_WHEEL: "Spin The Wheel",
  TRUTH_OR_DARE: "Truth or Dare",
  SLIDING_PUZZLE: "Puzzle",
  LOVE_DARTS: "Darts",
};

export default function PublicGameClient() {
  const { data: session } = useSession();
  const [selected, setSelected] = useState<GameType | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [nameSubmitted, setNameSubmitted] = useState(false);

  const isAuthed = !!session?.user?.id;
  const displayName = isAuthed ? undefined : playerName;

  const handleBack = useCallback(() => setSelected(null), []);

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim()) {
      toast.error("Masukkan nama kamu");
      return;
    }
    setNameSubmitted(true);
  }

  function renderGame() {
    switch (selected) {
      case "WOULD_YOU_RATHER":
        return <WouldYouRather playerName={displayName} />;
      case "TRIVIA":
        return <TriviaQuiz playerName={displayName} />;
      case "SPIN_THE_WHEEL":
        return <SpinTheWheel />;
      case "TRUTH_OR_DARE":
        return <TruthOrDare />;
      case "SLIDING_PUZZLE":
        return <SlidingPuzzle playerName={displayName} />;
      case "LOVE_DARTS":
        return <LoveDarts playerName={displayName} />;
      default:
        return null;
    }
  }

  if (!isAuthed && !nameSubmitted) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">Masuk untuk Main</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Masukkan nama kamu untuk bermain sebagai tamu. Login untuk masuk leaderboard
          </p>
        </div>
        <form onSubmit={handleNameSubmit} className="flex w-full flex-col gap-3">
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Nama kamu..."
            className="flex h-12 w-full rounded-xl border border-input bg-background px-4 text-center text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
            maxLength={50}
          />
          <Button type="submit" className="w-full gap-2">
            Mulai Main
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {selected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          key={selected}
        >
          <div className="mb-8 flex items-center gap-3">
            <button
              onClick={handleBack}
              className="rounded-full p-2 transition-colors hover:bg-accent"
              aria-label="Kembali"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-heading text-2xl">
                {gameLabels[selected]}
              </h1>
              <p className="text-sm text-muted-foreground">
                Main bersama pasangan, makin seru!
              </p>
            </div>
          </div>
          {renderGame()}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="font-heading text-3xl">Fun Games</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Pilih permainan seru untuk dimainkan bersama pasangan
            </p>
          </div>
          <GameSelector
            onSelect={setSelected}
            selected={selected}
          />

          <div className="mt-12">
            <div className="mb-6 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h2 className="font-heading text-xl font-semibold">Leaderboard</h2>
            </div>
            <LeaderBoard />
          </div>
        </motion.div>
      )}
    </div>
  );
}
