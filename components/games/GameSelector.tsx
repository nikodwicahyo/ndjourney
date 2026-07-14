"use client";

import { motion } from "framer-motion";
import { Shuffle, Brain, Cherry, Sparkles, Heart, Grid3x3, Blocks } from "lucide-react";
import type { GameType } from "@/types";

const gameTypes: {
  type: GameType;
  label: string;
  description: string;
  icon: typeof Shuffle;
  color: string;
}[] = [
  {
    type: "WOULD_YOU_RATHER",
    label: "Would You Rather?",
    description: "Pilih antara dua pilihan seru",
    icon: Shuffle,
    color: "#6366F1",
  },
  {
    type: "TRIVIA",
    label: "Love Quiz",
    description: "Tes seberapa dalam kamu mengenal pasangan",
    icon: Brain,
    color: "#F43F5E",
  },
  {
    type: "SPIN_THE_WHEEL",
    label: "Spin The Wheel",
    description: "Putar roda dan dapatkan ide kencan",
    icon: Cherry,
    color: "#22C55E",
  },
  {
    type: "TRUTH_OR_DARE",
    label: "Truth or Dare",
    description: "Permainan Truth or Dare untuk pasangan",
    icon: Sparkles,
    color: "#F97316",
  },
  {
    type: "SLIDING_PUZZLE",
    label: "Puzzle",
    description: "Tukar posisi kotak untuk menyusun foto",
    icon: Grid3x3,
    color: "#EC4899",
  },
  {
    type: "MEMORY_BLOCK_BLAST",
    label: "Block Blast",
    description: "Seret blok foto untuk menyusun dan menguungkap foto!",
    icon: Blocks,
    color: "#EC4899",
  },
];

type GameSelectorProps = {
  onSelect: (type: GameType) => void;
  selected: GameType | null;
};

export default function GameSelector({
  onSelect,
  selected,
}: GameSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {gameTypes.map(({ type, label, description, icon: Icon, color }, i) => (
        <motion.button
          key={type}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.08 }}
          onClick={() => onSelect(type)}
          className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 p-4 text-center transition-all hover:shadow-md sm:p-6 ${
            selected === type
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-muted-foreground/30"
          }`}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: color + "20" }}
          >
            <Icon className="h-6 w-6" style={{ color }} />
          </div>
          <div>
            <p className="font-heading font-semibold">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          {selected === type && (
            <motion.div
              layoutId="selected-game"
              className="absolute -top-2 -right-2"
            >
              <Heart className="h-5 w-5 fill-primary text-primary" />
            </motion.div>
          )}
        </motion.button>
      ))}
    </div>
  );
}
