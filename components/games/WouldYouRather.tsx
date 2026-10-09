"use client";

import { useState, useRef, useEffect } from "react";
import { useQuestionDeck, useSubmitScore } from "@/hooks/useGames";
import { Button, Skeleton } from "@/components/ui";
import { motion } from "framer-motion";
import { Shuffle, RefreshCw, Check, X, ArrowRight } from "lucide-react";
import type { GameQuestionWithMeta } from "@/hooks/useGames";

const BATCH_SIZE = 10;

type WouldYouRatherProps = {
  disableScoreSubmit?: boolean;
  playerName?: string;
};

export default function WouldYouRather({ disableScoreSubmit = false, playerName }: WouldYouRatherProps) {
  const deck = useQuestionDeck("WOULD_YOU_RATHER", BATCH_SIZE);
  const { isLoading, error, refetch } = deck;
  const submitScore = useSubmitScore();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [history, setHistory] = useState<Array<{ question: string; choice: string; correct: boolean }>>([]);
  const submittedRef = useRef<{ set: Set<string>, dataset: string }>({ set: new Set<string>(), dataset: '' });
  const { set: submittedSet, dataset } = submittedRef.current;
  // Reveal auto-advance must not fire after unmount (back navigation).
  const pickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (pickTimeoutRef.current) clearTimeout(pickTimeoutRef.current);
    };
  }, []);

  const batch = deck.batch;
  const totalQuestions = deck.total;
  const current = batch[currentIdx];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Gagal memuat pertanyaan</p>
        <Button onClick={() => refetch()}>Coba Lagi</Button>
      </div>
    );
  }

  if (!batch || batch.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Belum ada pertanyaan</p>
        <Button onClick={() => refetch()}>Muat Ulang</Button>
      </div>
    );
  }

  if (!current || finished) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
        >
          <Check className="h-10 w-10 text-primary" aria-hidden="true" />
        </motion.div>
        <div>
          <p className="font-heading text-xl font-semibold">Selesai! 🎉</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Skor: {score}/{batch.length}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={putaranBaru} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Main Lagi
          </Button>
        </div>
        {history.length > 0 && (
          <div className="mt-4 w-full max-w-md space-y-2 rounded-2xl border border-border bg-card p-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Riwayat Pilihan
            </p>
            {history.map((h, i) => (
              <p key={i} className="text-sm">
                <span className="text-muted-foreground">{i + 1}.</span> {h.question}
                <br />
                <span className="ml-4 inline-flex items-center gap-1 text-xs">
                  {h.correct ? (
                    <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
                  ) : (
                    <X className="h-3 w-3 text-red-500" aria-hidden="true" />
                  )}
                  → {h.choice}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  function pick(choice: string) {
    if (!current || picked) return;
    setPicked(choice);

    const correct =
      !current.answer ||
      current.answer.toLowerCase() === "none" ||
      (current.answer === "A" && choice === current.optionA) ||
      (current.answer === "B" && choice === current.optionB);

    setIsCorrect(correct);

    if (correct) setScore((s) => s + 1);

    // First attempts submit; repeats (true-exhaustion recycles) skip the
    // POST so the already-answered 409 never surfaces. Answered ids join
    // the deck either way, so quitting mid-round still excludes them.
    const fresh = deck.markAnswered(current.id);
    if (fresh && !disableScoreSubmit && !submittedSet.has(current.id)) {
      submittedSet.add(current.id);
      submitScore.mutate(
        { questionId: current.id, isCorrect: correct, playerName },
        { onError: () => {} },
      );
    }

    setHistory((prev) => [
      ...prev,
      { question: current.question, choice, correct },
    ]);
    pickTimeoutRef.current = setTimeout(() => {
      if (currentIdx < batch.length - 1) {
        setCurrentIdx((i) => i + 1);
        setPicked(null);
        setIsCorrect(null);
      } else {
        setFinished(true);
      }
    }, 1500);
  }

  // Fresh round from unseen questions — the deck key change auto-fetches,
  // so no manual refetch to race it. Used by both Main Lagi and Acak Ulang.
  function putaranBaru() {
    if (!batch) return;
    if (pickTimeoutRef.current) clearTimeout(pickTimeoutRef.current);
    submittedSet.clear();
    setFinished(false);
    setScore(0);
    setCurrentIdx(0);
    setHistory([]);
    setPicked(null);
    setIsCorrect(null);
    deck.restart(batch.map((q) => q.id));
  }

  const hasCorrectAnswer = !!(current?.answer && (current.answer === "A" || current.answer === "B"));

  function isCorrectOption(optValue: string) {
    if (!current) return false;
    return (current.answer === "A" && optValue === current.optionA) ||
           (current.answer === "B" && optValue === current.optionB);
  }

  function optionStyle(optValue: string) {
    if (!current) return "border-border bg-card";
    if (!picked) return "border-border bg-card hover:border-primary/50 hover:shadow-sm";
    const chosen = picked === optValue;
    const correct = isCorrectOption(optValue);
    if (chosen && correct) return "border-green-500 bg-green-500/10";
    if (chosen && !correct) return "border-red-500 bg-red-500/10";
    if (!chosen && correct && hasCorrectAnswer) return "border-green-500/50 bg-green-500/5";
    return "border-border opacity-50";
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {currentIdx + 1}/{batch.length}
          <span className="ml-2 text-xs text-muted-foreground/60">
            &middot; dari {totalQuestions} pertanyaan
          </span>
          <span className="ml-2 text-xs">
            &middot; Benar: {score}
          </span>
        </span>
        <button
          onClick={putaranBaru}
          className="inline-flex min-h-11 items-center gap-1 px-2 hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Acak Ulang
        </button>
      </div>
      {deck.cycled && (
        <p className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-center text-xs text-muted-foreground">
          Semua pertanyaan sudah dimainkan — mulai putaran baru 🎲
        </p>
      )}

      <motion.div
        key={current.id}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8 text-center"
      >
        <div className="mb-2 flex justify-center">
          <Shuffle className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <h2 className="font-heading text-xl font-semibold">
          {current.question}
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        {[
          { value: current.optionA || "Opsi A", label: current.optionA || "Opsi A" },
          { value: current.optionB || "Opsi B", label: current.optionB || "Opsi B" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => !picked && pick(opt.value)}
            disabled={!!picked}
            aria-label={picked && hasCorrectAnswer && isCorrectOption(opt.value) ? `${opt.label} — Benar` : opt.label}
            className={`relative rounded-2xl border-2 p-6 text-center font-medium transition-all ${optionStyle(opt.value)}`}
          >
            {opt.label}
            {picked && hasCorrectAnswer && isCorrectOption(opt.value) && (
              <span className="mt-1 block text-xs font-semibold text-green-600">
                {picked === opt.value ? "✓ Benar" : "Benar"}
              </span>
            )}
            {picked && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2"
              >
                {picked === opt.value && isCorrect !== null ? (
                  isCorrect ? (
                    <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
                  ) : (
                    <X className="h-5 w-5 text-red-500" aria-hidden="true" />
                  )
                ) : null}
                {picked !== opt.value && hasCorrectAnswer && isCorrectOption(opt.value) && (
                  <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
                )}
              </motion.div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
