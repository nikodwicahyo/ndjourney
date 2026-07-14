"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import GameSelector from "./GameSelector";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Grid3x3, Target } from "lucide-react";
import type { GameType } from "@/types";
import { Skeleton } from "@/components/ui";

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

type GameClientProps = {
  disableScoreSubmit?: boolean;
};

export default function GameClient({ disableScoreSubmit = false }: GameClientProps) {
  const [selected, setSelected] = useState<GameType | null>(null);

  const handleBack = useCallback(() => setSelected(null), []);

  const renderGame = () => {
    switch (selected) {
      case "WOULD_YOU_RATHER":
        return <WouldYouRather disableScoreSubmit={disableScoreSubmit} />;
      case "TRIVIA":
        return <TriviaQuiz disableScoreSubmit={disableScoreSubmit} />;
      case "SPIN_THE_WHEEL":
        return <SpinTheWheel />;
      case "TRUTH_OR_DARE":
        return <TruthOrDare />;
      case "SLIDING_PUZZLE":
        return <SlidingPuzzle />;
      case "LOVE_DARTS":
        return <LoveDarts />;
      default:
        return null;
    }
  };

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
        </motion.div>
      )}
    </div>
  );
}
