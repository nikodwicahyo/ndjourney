"use client";

import { useState, useEffect, useRef } from "react";
import { useQuestions, useSubmitScore } from "@/hooks/useGames";
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
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const { data, isLoading, error, refetch } = useQuestions("WOULD_YOU_RATHER", BATCH_SIZE, seenIds);
  const submitScore = useSubmitScore();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [history, setHistory] = useState<Array<{ question: string; choice: string; correct: boolean }>>([]);
  const submittedRef = useRef(new Set<string>());

  const batch = data?.questions ?? [];
  const totalQuestions = data?.total ?? 0;
  const current = batch[currentIdx];

  // Reset state when new batch arrives
  useEffect(() => {
    if (batch && batch.length > 0) {
      setCurrentIdx(0);
      setPicked(null);
      setIsCorrect(null);
      setScore(0);
      setFinished(false);
      setHistory([]);
    }
  }, [batch]);

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
          <Check className="h-10 w-10 text-primary" />
        </motion.div>
        <div>
          <p className="font-heading text-xl font-semibold">Selesai! 🎉</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Skor: {score}/{batch.length}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={mainLagi} className="gap-2">
            <RefreshCw className="h-4 w-4" />
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
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <X className="h-3 w-3 text-red-500" />
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

    if (!disableScoreSubmit && !submittedRef.current.has(current.id)) {
      submittedRef.current.add(current.id);
      submitScore.mutate(
        { questionId: current.id, isCorrect: correct, playerName },
        { onError: () => {} },
      );
    }

    setHistory((prev) => [
      ...prev,
      { question: current.question, choice, correct },
    ]);
    setTimeout(() => {
      if (currentIdx < batch.length - 1) {
        setCurrentIdx((i) => i + 1);
        setPicked(null);
        setIsCorrect(null);
      } else {
        setFinished(true);
      }
    }, 1500);
  }

  function mainLagi() {
    if (!batch) return;
    submittedRef.current.clear();
    const newSeen = [...seenIds, ...batch.map((q) => q.id)];
    setSeenIds(newSeen);
    refetch();
  }

  function acakUlang() {
    if (!batch) return;
    submittedRef.current.clear();
    setSeenIds(prev => [...prev, ...batch.map(q => q.id)]);
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
          onClick={acakUlang}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Acak Ulang
        </button>
      </div>

      <motion.div
        key={current.id}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8 text-center"
      >
        <div className="mb-2 flex justify-center">
          <Shuffle className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-heading text-xl font-semibold">
          {current.question}
        </h2>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { value: current.optionA || "Opsi A", label: current.optionA || "Opsi A" },
          { value: current.optionB || "Opsi B", label: current.optionB || "Opsi B" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => !picked && pick(opt.value)}
            disabled={!!picked}
            className={`relative rounded-2xl border-2 p-6 text-center font-medium transition-all ${optionStyle(opt.value)}`}
          >
            {opt.label}
            {picked && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2"
              >
                {picked === opt.value && isCorrect !== null ? (
                  isCorrect ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <X className="h-5 w-5 text-red-500" />
                  )
                ) : null}
                {picked !== opt.value && hasCorrectAnswer && isCorrectOption(opt.value) && (
                  <Check className="h-5 w-5 text-green-500" />
                )}
              </motion.div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
