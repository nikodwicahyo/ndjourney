"use client";

import { useState, useEffect, useRef } from "react";
import { useQuestions, useSubmitScore } from "@/hooks/useGames";
import { Button, Skeleton } from "@/components/ui";
import { motion } from "framer-motion";
import { Brain, RefreshCw, Check, X, ArrowRight } from "lucide-react";

const BATCH_SIZE = 10;

type TriviaQuizProps = {
  disableScoreSubmit?: boolean;
  playerName?: string;
};

export default function TriviaQuiz({ disableScoreSubmit = false, playerName }: TriviaQuizProps) {
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const { data, isLoading, error, refetch } = useQuestions("TRIVIA", BATCH_SIZE, seenIds);
  const submitScore = useSubmitScore();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<Array<{ question: string; correct: boolean }>>([]);
  const submittedRef = useRef<{ set: Set<string>, dataset: string }>({ set: new Set<string>(), dataset: '' });
  const { set: submittedSet, dataset } = submittedRef.current;

  const batch = data?.questions ?? [];
  const totalQuestions = data?.total ?? 0;
  const current = batch[currentIdx];

  // Do NOT reset state on data changes from random refetches
  useEffect(() => {
    // Session state remains stable during background refreshes.
  }, [batch]);

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && userAnswer.trim() && !revealed) {
      revealAnswer();
    }
  }

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
          <Brain className="h-10 w-10 text-primary" />
        </motion.div>
        <div>
          <p className="font-heading text-xl font-semibold">Selesai! 🎯</p>
          <p className="mt-2 text-muted-foreground">
            Skor: {score}/{batch.length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {score === batch.length
              ? "Sempurna! Kamu benar-benar kenal pasanganmu! 💕"
              : score >= batch.length / 2
                ? "Lumayan! Masih ada ruang untuk tahu lebih banyak 😊"
                : "Yuk kenali pasanganmu lebih dalam lagi! 💪"}
          </p>
        </div>
        <Button onClick={mainLagi} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Main Lagi
        </Button>
        {results.length > 0 && (
          <div className="mt-4 w-full max-w-md space-y-2 rounded-2xl border border-border bg-card p-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Hasil
            </p>
            {results.map((r, i) => (
              <p key={i} className="flex items-center gap-2 text-sm">
                {r.correct ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 text-red-500" />
                )}
                {r.question}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  async function revealAnswer() {
    if (!current) return;
    setRevealed(true);
    const isCorrect =
      current.answer?.toLowerCase() === "none" ||
      userAnswer.toLowerCase().trim() === current.answer?.toLowerCase().trim();

    if (isCorrect) setScore((s) => s + 1);

    setResults((prev) => [
      ...prev,
      { question: current.question, correct: isCorrect },
    ]);

    if (!disableScoreSubmit && !submittedSet.has(current.id)) {
      submittedSet.add(current.id);
      try {
        await submitScore.mutateAsync({
          questionId: current.id,
          isCorrect,
          playerName,
        });
      } catch {
        // silent
      }
    }
  }

  function next() {
    if (!batch) return;
    if (currentIdx < batch.length - 1) {
      setCurrentIdx((i) => i + 1);
      setUserAnswer("");
      setRevealed(false);
    } else {
      setFinished(true);
    }
  }

  function mainLagi() {
    if (!batch) return;
    submittedSet.clear();
    setFinished(false);
    setScore(0);
    setCurrentIdx(0);
    setResults([]);
    setUserAnswer("");
    setRevealed(false);
    const newSeen = [...seenIds, ...batch.map((q) => q.id)];
    setSeenIds(newSeen);
    refetch();
  }

  function acakUlang() {
    if (!batch) return;
    submittedSet.clear();
    setSeenIds(prev => [...prev, ...batch.map(q => q.id)]);
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {currentIdx + 1}/{batch.length}
          <span className="ml-2 text-xs text-muted-foreground/60">
            &middot; dari {totalQuestions} pertanyaan
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
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-heading text-xl font-semibold">
          {current.question}
        </h2>
        {current.category && (
          <p className="mt-1 text-xs text-muted-foreground">
            {current.category}
          </p>
        )}
      </motion.div>

      {!revealed ? (
        <div className="space-y-4">
          <input
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ketik jawabanmu..."
            className="flex h-12 w-full rounded-xl border border-input bg-background px-4 text-center text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <Button
            className="w-full"
            disabled={!userAnswer.trim()}
            onClick={revealAnswer}
          >
            Lihat Jawaban
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 text-center"
        >
          <div
            className={`rounded-2xl border-2 p-6 ${
              current.answer?.toLowerCase() === "none"
                ? "border-green-500/30 bg-green-500/5"
                : userAnswer.toLowerCase().trim() === current.answer?.toLowerCase().trim()
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <p className="text-sm text-muted-foreground">Jawaban kamu:</p>
            <p className="mt-1 font-medium">{userAnswer}</p>
            {current.answer?.toLowerCase() !== "none" && (
              <>
                <p className="mt-3 text-sm text-muted-foreground">Jawaban sebenarnya:</p>
                <p className="mt-1 font-medium text-primary">{current.answer}</p>
              </>
            )}
            {current.answer?.toLowerCase() === "none" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Tidak ada jawaban benar — diskusikan dengan pasanganmu!
              </p>
            )}
          </div>

          <Button onClick={next} className="gap-2">
            {currentIdx < batch.length - 1 ? "Selanjutnya" : "Lihat Skor"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
