"use client";

import { useState } from "react";
import { useAllQuestions } from "@/hooks/useGames";
import { Button, Skeleton } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, Shuffle } from "lucide-react";

export default function TruthOrDare() {
  const { data: questions, isLoading, error, refetch } = useAllQuestions("TRUTH_OR_DARE");
  const [mode, setMode] = useState<"select" | "result">("select");
  const [currentCard, setCurrentCard] = useState<{
    question: string;
    category: string;
  } | null>(null);
  const [history, setHistory] = useState<
    Array<{ question: string; category: string }>
  >([]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error || !questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Belum ada kartu</p>
        <Button onClick={() => refetch()}>Muat Ulang</Button>
      </div>
    );
  }

  const truths = questions.filter((q) => q.category === "Truth");
  const dares = questions.filter((q) => q.category === "Dare");

  function pick(category: "Truth" | "Dare") {
    const pool = category === "Truth" ? truths : dares;
    if (pool.length === 0) return;

    const usedIds = new Set(history.map((h) => h.question));
    const available = pool.filter((q) => !usedIds.has(q.question));
    const pickFrom = available.length > 0 ? available : pool;

    const card = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    setCurrentCard({ question: card.question, category });
    setMode("result");
  }

  function next() {
    if (currentCard) {
      setHistory((prev) => [currentCard, ...prev].slice(0, 20));
    }
    setCurrentCard(null);
    setMode("select");
  }

  return (
    <div className="mx-auto max-w-lg">
      <AnimatePresence mode="wait">
        {mode === "select" ? (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6 py-8"
          >
            <p className="text-center text-muted-foreground">
              Pilih salah satu:
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => pick("Truth")}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-blue-500/30 bg-blue-500/5 p-8 transition-all hover:border-blue-500 hover:shadow-md"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20 text-3xl">
                  😇
                </div>
                <span className="font-heading text-lg font-semibold">
                  Jujur
                </span>
                <span className="text-xs text-muted-foreground">
                  {truths.length} pertanyaan
                </span>
              </button>

              <button
                onClick={() => pick("Dare")}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-orange-500/30 bg-orange-500/5 p-8 transition-all hover:border-orange-500 hover:shadow-md"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20 text-3xl">
                  😈
                </div>
                <span className="font-heading text-lg font-semibold">
                  Tantangan
                </span>
                <span className="text-xs text-muted-foreground">
                  {dares.length} tantangan
                </span>
              </button>
            </div>
          </motion.div>
        ) : currentCard ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9, rotateY: 180 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-6 py-8"
          >
            <div
              className={`w-full rounded-2xl border-2 p-8 text-center ${
                currentCard.category === "Truth"
                  ? "border-blue-500/30 bg-blue-500/5"
                  : "border-orange-500/30 bg-orange-500/5"
              }`}
            >
              <span className="text-4xl">
                {currentCard.category === "Truth" ? "😇" : "😈"}
              </span>
              <p className="mt-4 font-heading text-lg font-semibold">
                {currentCard.category === "Truth" ? "JUJUR" : "TANTANGAN"}
              </p>
              <p className="mt-4 text-base leading-relaxed">
                {currentCard.question}
              </p>
            </div>

            <div className="flex gap-3">
              <Button onClick={next} className="gap-2">
                <Shuffle className="h-4 w-4" />
                {history.length > 0 ? "Lagi" : "Berikutnya"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentCard(null);
                  setMode("select");
                }}
              >
                Ganti Mode
              </Button>
            </div>

            {history.length > 0 && (
              <div className="mt-4 w-full space-y-2 rounded-2xl border border-border bg-card p-4 text-left">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Riwayat
                </p>
                {history.map((h, i) => (
                  <p key={i} className="flex items-start gap-2 text-sm">
                    <span>{h.category === "Truth" ? "😇" : "😈"}</span>
                    <span className="text-muted-foreground">{h.question}</span>
                  </p>
                ))}
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
